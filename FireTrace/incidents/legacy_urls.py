"""Deprecated /incidents/ routes kept for the shipped civilian app.

These point at *reports*, which is what the path always actually served -- the
name predates the report/incident split. New clients should use
``/api/reports/``. Remove this module once the civilian frontend has moved
over; nothing else references it.
"""

from django.urls import path

from . import views

urlpatterns = [
    path('', views.IncidentReportListCreateView.as_view()),
    path('<int:pk>/', views.IncidentReportDetailView.as_view()),
]
