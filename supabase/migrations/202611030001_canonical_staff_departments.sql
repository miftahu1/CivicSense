-- Normalize legacy free-text AI suggestions and staff assignments to the
-- department vocabulary used by report routing and the staff work queue.
with normalized as (
  select id,
    regexp_replace(lower(trim(department)), '[^a-z0-9]+', '', 'g') as department_key
  from public.profiles
  where role = 'staff' and department is not null
)
update public.profiles as profile
set department = case normalized.department_key
  when 'facilities' then 'Facilities & Maintenance'
  when 'facility' then 'Facilities & Maintenance'
  when 'facilitiesandmaintenance' then 'Facilities & Maintenance'
  when 'maintenance' then 'Facilities & Maintenance'
  when 'maintenancedepartment' then 'Facilities & Maintenance'
  when 'buildingmaintenance' then 'Facilities & Maintenance'
  when 'electrical' then 'Electrical Services'
  when 'electricaldepartment' then 'Electrical Services'
  when 'electricalwing' then 'Electrical Services'
  when 'electricalmaintenance' then 'Electrical Services'
  when 'it' then 'IT Services'
  when 'itdepartment' then 'IT Services'
  when 'technologyandit' then 'IT Services'
  when 'technologyservices' then 'IT Services'
  when 'computerservices' then 'IT Services'
  when 'library' then 'Library Services'
  when 'libraryadministration' then 'Library Services'
  when 'librarydepartment' then 'Library Services'
  when 'sanitation' then 'Sanitation & Waste'
  when 'waste' then 'Sanitation & Waste'
  when 'sanitationandwaste' then 'Sanitation & Waste'
  when 'janitorial' then 'Sanitation & Waste'
  when 'cleaning' then 'Sanitation & Waste'
  when 'studenthousing' then 'Student Housing'
  when 'hostel' then 'Student Housing'
  when 'hosteladministration' then 'Student Housing'
  when 'hostelmaintenance' then 'Student Housing'
  when 'housing' then 'Student Housing'
  when 'health' then 'Health Services'
  when 'healthcentre' then 'Health Services'
  when 'healthcenter' then 'Health Services'
  when 'medicalservices' then 'Health Services'
  else profile.department
end
from normalized
where profile.id = normalized.id
  and normalized.department_key in (
    'facilities','facility','facilitiesandmaintenance','maintenance','maintenancedepartment','buildingmaintenance',
    'electrical','electricaldepartment','electricalwing','electricalmaintenance',
    'it','itdepartment','technologyandit','technologyservices','computerservices',
    'library','libraryadministration','librarydepartment',
    'sanitation','waste','sanitationandwaste','janitorial','cleaning',
    'studenthousing','hostel','hosteladministration','hostelmaintenance','housing',
    'health','healthcentre','healthcenter','medicalservices'
  );

with normalized as (
  select id,
    regexp_replace(lower(trim(department)), '[^a-z0-9]+', '', 'g') as department_key
  from public.reports
  where department is not null
)
update public.reports as report
set department = case normalized.department_key
  when 'facilities' then 'Facilities & Maintenance'
  when 'facility' then 'Facilities & Maintenance'
  when 'facilitiesandmaintenance' then 'Facilities & Maintenance'
  when 'maintenance' then 'Facilities & Maintenance'
  when 'maintenancedepartment' then 'Facilities & Maintenance'
  when 'buildingmaintenance' then 'Facilities & Maintenance'
  when 'electrical' then 'Electrical Services'
  when 'electricaldepartment' then 'Electrical Services'
  when 'electricalwing' then 'Electrical Services'
  when 'electricalmaintenance' then 'Electrical Services'
  when 'it' then 'IT Services'
  when 'itdepartment' then 'IT Services'
  when 'technologyandit' then 'IT Services'
  when 'technologyservices' then 'IT Services'
  when 'computerservices' then 'IT Services'
  when 'library' then 'Library Services'
  when 'libraryadministration' then 'Library Services'
  when 'librarydepartment' then 'Library Services'
  when 'sanitation' then 'Sanitation & Waste'
  when 'waste' then 'Sanitation & Waste'
  when 'sanitationandwaste' then 'Sanitation & Waste'
  when 'janitorial' then 'Sanitation & Waste'
  when 'cleaning' then 'Sanitation & Waste'
  when 'studenthousing' then 'Student Housing'
  when 'hostel' then 'Student Housing'
  when 'hosteladministration' then 'Student Housing'
  when 'hostelmaintenance' then 'Student Housing'
  when 'housing' then 'Student Housing'
  when 'health' then 'Health Services'
  when 'healthcentre' then 'Health Services'
  when 'healthcenter' then 'Health Services'
  when 'medicalservices' then 'Health Services'
  else report.department
end
from normalized
where report.id = normalized.id
  and normalized.department_key in (
    'facilities','facility','facilitiesandmaintenance','maintenance','maintenancedepartment','buildingmaintenance',
    'electrical','electricaldepartment','electricalwing','electricalmaintenance',
    'it','itdepartment','technologyandit','technologyservices','computerservices',
    'library','libraryadministration','librarydepartment',
    'sanitation','waste','sanitationandwaste','janitorial','cleaning',
    'studenthousing','hostel','hosteladministration','hostelmaintenance','housing',
    'health','healthcentre','healthcenter','medicalservices'
  );

with normalized as (
  select id,
    regexp_replace(lower(trim(assigned_department)), '[^a-z0-9]+', '', 'g') as department_key
  from public.reports
  where assigned_department is not null
)
update public.reports as report
set assigned_department = case normalized.department_key
  when 'facilities' then 'Facilities & Maintenance'
  when 'facility' then 'Facilities & Maintenance'
  when 'facilitiesandmaintenance' then 'Facilities & Maintenance'
  when 'maintenance' then 'Facilities & Maintenance'
  when 'maintenancedepartment' then 'Facilities & Maintenance'
  when 'buildingmaintenance' then 'Facilities & Maintenance'
  when 'electrical' then 'Electrical Services'
  when 'electricaldepartment' then 'Electrical Services'
  when 'electricalwing' then 'Electrical Services'
  when 'electricalmaintenance' then 'Electrical Services'
  when 'it' then 'IT Services'
  when 'itdepartment' then 'IT Services'
  when 'technologyandit' then 'IT Services'
  when 'technologyservices' then 'IT Services'
  when 'computerservices' then 'IT Services'
  when 'library' then 'Library Services'
  when 'libraryadministration' then 'Library Services'
  when 'librarydepartment' then 'Library Services'
  when 'sanitation' then 'Sanitation & Waste'
  when 'waste' then 'Sanitation & Waste'
  when 'sanitationandwaste' then 'Sanitation & Waste'
  when 'janitorial' then 'Sanitation & Waste'
  when 'cleaning' then 'Sanitation & Waste'
  when 'studenthousing' then 'Student Housing'
  when 'hostel' then 'Student Housing'
  when 'hosteladministration' then 'Student Housing'
  when 'hostelmaintenance' then 'Student Housing'
  when 'housing' then 'Student Housing'
  when 'health' then 'Health Services'
  when 'healthcentre' then 'Health Services'
  when 'healthcenter' then 'Health Services'
  when 'medicalservices' then 'Health Services'
  else report.assigned_department
end
from normalized
where report.id = normalized.id
  and normalized.department_key in (
    'facilities','facility','facilitiesandmaintenance','maintenance','maintenancedepartment','buildingmaintenance',
    'electrical','electricaldepartment','electricalwing','electricalmaintenance',
    'it','itdepartment','technologyandit','technologyservices','computerservices',
    'library','libraryadministration','librarydepartment',
    'sanitation','waste','sanitationandwaste','janitorial','cleaning',
    'studenthousing','hostel','hosteladministration','hostelmaintenance','housing',
    'health','healthcentre','healthcenter','medicalservices'
  );
