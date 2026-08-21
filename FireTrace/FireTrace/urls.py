"""URL configuration for FireTrace.

Route map:
    /accounts/          auth (register, login, refresh, me)
    /api/reports/       civilian submissions
    /api/incidents/     canonical, personnel-verified events
    /api/dashboard/     BFP portal aggregates (KPIs, map, activity, health)
    /incidents/         deprecated alias for /api/reports/ (shipped mobile app)
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('api/', include('incidents.urls')),
    path('api/dashboard/', include('analytics.urls')),
    # Kept working while the civilian app still points here. See legacy_urls.
    path('incidents/', include('incidents.legacy_urls')),
]

if settings.DEBUG:
    # Report photos. In production these are served by the web server, not Django.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
