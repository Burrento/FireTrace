"""Grade reports that predate the confidence field.

New columns land with the safest default (Low), which would quietly drop every
existing report off the operations map. Every one of those reports came through
a wizard that required the reporter to confirm a pin they placed themselves —
the same capture path that grades High today — so backfill them accordingly
rather than leaving accurate data looking untrustworthy.

Anything without a confirmed pin stays Low, which is the honest reading.
"""

from django.db import migrations


def grade_existing_reports(apps, schema_editor):
    IncidentReport = apps.get_model('incidents', 'IncidentReport')
    IncidentReport.objects.filter(location_confirmed=True).update(
        location_source='map_pin',
        geocoding_confidence='high',
    )


def reset_to_default(apps, schema_editor):
    IncidentReport = apps.get_model('incidents', 'IncidentReport')
    IncidentReport.objects.update(geocoding_confidence='low')


class Migration(migrations.Migration):

    dependencies = [
        ('incidents', '0003_incidenttimelineevent_and_more'),
    ]

    operations = [
        migrations.RunPython(grade_existing_reports, reset_to_default),
    ]
