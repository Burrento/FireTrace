from django.http import JsonResponse
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import User
from .serializers import RegisterSerializer, UserSerializer


def ping(request):
    return JsonResponse({"message": "Django says hello to React"})


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
