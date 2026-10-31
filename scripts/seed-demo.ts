import "dotenv/config";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { demoClusters, demoReports } from "../lib/demo-data";
import { embedReport } from "../lib/ai";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
const password=process.env.DEMO_PASSWORD;
if(!url||!serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
if(!password||password.length<12) throw new Error("Set DEMO_PASSWORD to a password of at least 12 characters.");
const supabase=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
const accounts=[
  {key:"student",email:"student@civicsense.demo",name:"Ananya Saikia",role:"student"},
  {key:"staff",email:"staff@civicsense.demo",name:"M. Hazarika",role:"staff"},
  {key:"admin",email:"admin@civicsense.demo",name:"Operations desk",role:"admin"},
] as const;

function stableUuid(key:string){const hex=createHash("sha256").update(key).digest("hex").slice(0,32).split("");hex[12]="5";hex[16]=((parseInt(hex[16],16)&3)|8).toString(16);const value=hex.join("");return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;}

async function main(){
  const ids:Record<string,string>={};
  const {data:{users},error:listError}=await supabase.auth.admin.listUsers({page:1,perPage:1000});
  if(listError)throw listError;
  for(const account of accounts){
    let authUser=users.find((item)=>item.email?.toLowerCase()===account.email);
    if(!authUser){const {data,error}=await supabase.auth.admin.createUser({email:account.email,password,email_confirm:true,user_metadata:{full_name:account.name,role:account.role,preferred_language:"en"}});if(error)throw error;authUser=data.user;}
    if(!authUser)throw new Error(`Could not provision ${account.email}`);
    ids[account.key]=authUser.id;
    const {error}=await supabase.from("profiles").upsert({id:authUser.id,full_name:account.name,role:account.role,preferred_language:"en"},{onConflict:"id"});
    if(error)throw error;
  }
  const clusterIds=new Map(demoClusters.map((cluster)=>[cluster.id,stableUuid(`cluster:${cluster.id}`)]));
  for(const cluster of demoClusters){const {error}=await supabase.from("issue_clusters").upsert({id:clusterIds.get(cluster.id),title:cluster.title,category:cluster.category,location:cluster.location,status:cluster.status,assigned_to_name:cluster.assignedTo,created_by:ids.admin,created_at:cluster.createdAt},{onConflict:"id"});if(error)throw error;}
  const reportIds=new Map<string,string>();
  for(const report of demoReports){
    const reporter=report.reporterId==="demo-staff"?ids.staff:ids.student;
    const values={ticket_number:report.ticketNumber,reporter_id:reporter,original_text:report.originalText,original_language:report.originalLanguage,title_en:report.titleEn,title_as:report.titleAs,summary_en:report.summaryEn,summary_as:report.summaryAs,category:report.category,suggested_priority:report.suggestedPriority,confirmed_priority:report.confirmedPriority,priority_explanation:report.priorityExplanation,department:report.department,location_building:report.building,location_area:report.area,status:report.status,cluster_id:report.clusterId?clusterIds.get(report.clusterId):null,assigned_to_name:report.assignedTo,sensitive_flag:report.sensitive,is_synthetic:true,analysis_status:"complete",analysis_confidence:0.92,created_at:report.createdAt,updated_at:report.updatedAt};
    const {data,error}=await supabase.from("reports").upsert(values,{onConflict:"ticket_number"}).select("id,ticket_number").single();
    if(error)throw error;
    reportIds.set(report.id,data.id);
  }
  for(const report of demoReports){
    const id=reportIds.get(report.id)!;
    for(const event of report.events){
      const eventId=stableUuid(`event:${report.ticketNumber}:${event.id}`);
      const {error}=await supabase.from("report_events").upsert({id:eventId,report_id:id,actor_id:ids.admin,actor_name:event.actor,old_status:event.oldStatus,new_status:event.newStatus,message:`Synthetic demonstration: ${event.message}`,created_at:event.createdAt},{onConflict:"id"});
      if(error)throw error;
    }
  }
  if(process.env.GEMINI_API_KEY){
    for(const report of demoReports){const values=await embedReport(report.originalText,report.building,report.area);const {error}=await supabase.rpc("save_report_embedding",{p_report_id:reportIds.get(report.id),p_embedding_text:`[${values.join(",")}]`,p_model_name:process.env.GEMINI_EMBEDDING_MODEL||"gemini-embedding-2"});if(error)throw error;console.log(`Embedded ${report.ticketNumber} (${report.originalLanguage}).`);}
  }else console.log("Gemini is not configured; synthetic reports were seeded without vectors. Configure GEMINI_API_KEY and rerun to create semantic search vectors.");
  console.log("\nSynthetic CivicSense demo data is ready.");
  console.log(`Shared demo password: ${password}`);
  accounts.forEach((account)=>console.log(`${account.role.padEnd(7)} ${account.email}`));
  console.log("All seeded reports and events are explicitly marked as synthetic demonstration data.");
}
void main();
