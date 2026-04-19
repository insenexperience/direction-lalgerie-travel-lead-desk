# Checklist RLS production (PRD §8.2)

À exécuter sur le projet Supabase **production** (SQL Editor) après chaque changement de policies.

```sql
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

Vérifier notamment qu’il ne reste **pas** de policies permissives historiques sur `public.leads` (`leads_all_authenticated`, `leads_select_pool_all_authenticated`) : elles doivent être absentes depuis la migration `20260423140000_rls_admin_vs_referent_v1.sql`.
