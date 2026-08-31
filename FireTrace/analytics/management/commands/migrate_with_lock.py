"""``migrate``, serialised across replicas.

The container migrates on boot (see the Dockerfile CMD). ``firetrace-backend``
scales from 0 to 10 replicas, so several containers can cold-start at once and
each would run ``migrate`` against the same database. Django takes no global
migration lock: two replicas can both find a migration unapplied, both try to
apply it, and the loser dies on "relation already exists". With ``&&`` in the
CMD that means a crash loop until the winner finishes -- self-healing, but
indistinguishable from a broken deploy at the moment you are watching one.

A Postgres advisory lock makes the losers *wait* instead of fail. It is tied to
the session, so a replica killed mid-migration releases it rather than
stranding every future boot.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

# Arbitrary but fixed: any constant works so long as every replica uses the
# same one. Namespaced by year so it will not collide with another advisory
# lock if this database is ever shared.
MIGRATION_LOCK_ID = 85712026


class Command(BaseCommand):
    help = 'Run migrate while holding a database-wide advisory lock.'

    def handle(self, *args, **options):
        # SQLite has no advisory locks, and nothing to serialise against: local
        # runs are a single process. Falling through keeps `manage.py
        # migrate_with_lock` usable on a dev machine.
        if connection.vendor != 'postgresql':
            call_command('migrate', '--noinput')
            return

        with connection.cursor() as cursor:
            self.stdout.write('Acquiring migration lock...')
            # Blocking on purpose. A replica arriving second should wait for the
            # first to finish, not race it and not give up and serve traffic
            # against a schema it has not checked.
            cursor.execute('SELECT pg_advisory_lock(%s)', [MIGRATION_LOCK_ID])
            try:
                call_command('migrate', '--noinput')
            finally:
                cursor.execute('SELECT pg_advisory_unlock(%s)', [MIGRATION_LOCK_ID])
                self.stdout.write('Released migration lock.')
