create index if not exists reports_assigned_to_idx on public.reports(assigned_to) where assigned_to is not null;
create index if not exists reports_department_idx on public.reports(department);
create index if not exists issue_clusters_assigned_to_idx on public.issue_clusters(assigned_to) where assigned_to is not null;
