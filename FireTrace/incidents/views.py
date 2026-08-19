from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Incident
from .serializers import IncidentSerializer


class IncidentQuerysetMixin:
    def get_queryset(self):
        user = self.request.user
        qs = Incident.objects.all()
        if user.user_type == 'civilian':
            qs = qs.filter(reporter=user)
        return qs


class IncidentListCreateView(IncidentQuerysetMixin, generics.ListCreateAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]


class IncidentDetailView(IncidentQuerysetMixin, generics.RetrieveAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]
