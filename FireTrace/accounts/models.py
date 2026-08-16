from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class UserType(models.TextChoices):
        BFP = 'bfp', 'BFP'
        CIVILIAN = 'civilian', 'Civilian'

    user_type = models.CharField(max_length=10, choices=UserType.choices, default=UserType.CIVILIAN)
