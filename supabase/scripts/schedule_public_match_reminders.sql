-- Run once in the Supabase SQL Editor after enabling pg_cron, pg_net, and Vault.
-- Store the URL and exact CRON_SECRET value configured in Vercel as Vault secrets.
-- Replace both placeholders before running; do not commit real secrets here.
select vault.create_secret(
  'https://vfl-iota.vercel.app/api/cron/pre-match-reminders',
  'public_match_reminder_url',
  'Production endpoint for LeagueForge scheduled match reminders'
);

select vault.create_secret(
  'REPLACE_WITH_CRON_SECRET',
  'public_match_reminder_secret',
  'Bearer secret for LeagueForge scheduled match reminders'
);

-- Avoid duplicate jobs when this setup is rerun.
select cron.unschedule(jobid)
from cron.job
where jobname = 'leagueforge-public-match-reminders';

select cron.schedule(
  'leagueforge-public-match-reminders',
  '* * * * *',
  $$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'public_match_reminder_url'),
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'public_match_reminder_secret')
      ),
      timeout_milliseconds := 10000
    );
  $$
);
