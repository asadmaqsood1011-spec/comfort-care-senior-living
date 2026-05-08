# Production v2 Auth Seed Notes

Run `production-v2.sql` first, then create users in Supabase Auth.

For the first owner account:

1. Supabase Dashboard -> Authentication -> Users -> Add user.
2. Copy the new Auth user UUID.
3. Insert a matching profile and location access row with the SQL below.

```sql
insert into public.profiles (id, full_name, email, role, active)
values (
  'AUTH_USER_UUID_HERE',
  'Owner Name',
  'owner@example.com',
  'super_admin',
  true
)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  active = excluded.active;

insert into public.user_location_access (user_id, location_id, access_level)
select 'AUTH_USER_UUID_HERE', id, 'super_admin'
from public.locations
on conflict (user_id, location_id) do update set
  access_level = excluded.access_level;
```

After this, the owner can log in at `/admin-v2`.

Required Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

The existing `/admin` route remains available during migration.
