from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('ping', views.ping),
    path('register', views.RegisterView.as_view()),
    path('login', views.LoginView.as_view()),
    path('login/refresh', TokenRefreshView.as_view()),
    path('logout', views.LogoutView.as_view()),
    path('me', views.MeView.as_view()),
    path('me/password', views.ChangePasswordView.as_view()),
    # Account administration. Restricted to BFP personnel, not to staff: the
    # portal and the Django admin are separate surfaces with separate gates.
    path('users', views.UserAdminListView.as_view()),
    path('users/<int:pk>', views.UserAdminDetailView.as_view()),
]
