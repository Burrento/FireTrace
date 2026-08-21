"""Dashboard aggregates, mounted at /api/dashboard/.

The map endpoint lives in ``incidents.views`` because it reads incident data,
but it is routed here so the whole dashboard surface sits behind one prefix.
"""

from django.urls import path

from incidents.views import DashboardMapView

from . import views

urlpatterns = [
    path('kpis/', views.DashboardKPIView.as_view()),
    path('activity/', views.RecentActivityView.as_view()),
    path('health/', views.SystemHealthView.as_view()),
    path('map/', DashboardMapView.as_view()),
]
