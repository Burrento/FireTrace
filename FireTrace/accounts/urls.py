from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('ping', views.ping),
    path('register', views.RegisterView.as_view()),
    path('login', views.LoginView.as_view()),
    path('login/refresh', TokenRefreshView.as_view()),
    path('me', views.MeView.as_view()),
]
