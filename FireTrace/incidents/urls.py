"""Incident API, mounted at /api/.

Reports and canonical incidents get separate route trees, mirroring the fact
that they are separate record types rather than two views of one thing.
"""

from django.urls import path

from . import views

urlpatterns = [
    # Civilian submissions
    path('reports/', views.IncidentReportListCreateView.as_view()),
    path('reports/queue/', views.ReportQueueView.as_view()),
    path('reports/<int:pk>/', views.IncidentReportDetailView.as_view()),
    path('reports/<int:pk>/status/', views.ReportWorkflowStatusView.as_view()),
    path('reports/<int:pk>/duplicate-review/', views.ReportDuplicateReviewView.as_view()),
    path('reports/<int:pk>/timeline/', views.ReportTimelineView.as_view()),

    # Ongoing fires, readable by any signed-in user (see the view's docstring
    # for why this one is not personnel-only).
    path('incidents/ongoing/', views.OngoingFireMapView.as_view()),

    # Canonical, personnel-verified events
    path('incidents/', views.IncidentListCreateView.as_view()),
    path('incidents/verify/', views.IncidentVerifyView.as_view()),
    path('incidents/<int:pk>/', views.IncidentDetailView.as_view()),
    path('incidents/<int:pk>/status/', views.IncidentWorkflowStatusView.as_view()),
    path('incidents/<int:pk>/timeline/', views.IncidentTimelineView.as_view()),
]
