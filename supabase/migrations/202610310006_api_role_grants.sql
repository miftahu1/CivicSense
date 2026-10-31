-- RLS policies do not grant SQL table privileges. Give API roles only the
-- table access their policies and server-side workflows require.
grant usage on schema public to authenticated, service_role;

grant select on table
  public.profiles,
  public.reports,
  public.attachments,
  public.report_events,
  public.issue_clusters
to authenticated;

-- The service key is used only by server routes and must be able to perform
-- the profile recovery and report workflow operations after bypassing RLS.
grant select, insert, update, delete on table
  public.profiles,
  public.issue_clusters,
  public.reports,
  public.attachments,
  public.report_events,
  public.report_embeddings,
  public.report_submission_limits
to service_role;

grant usage, select, update on sequence public.civicsense_ticket_seq to service_role;
