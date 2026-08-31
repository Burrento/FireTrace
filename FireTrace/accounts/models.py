from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class UserType(models.TextChoices):
        BFP = 'bfp', 'BFP'
        CIVILIAN = 'civilian', 'Civilian'

    user_type = models.CharField(max_length=10, choices=UserType.choices, default=UserType.CIVILIAN)

    # Contact details the reporter maintains themselves. Blank rather than null
    # so "not given" is one value rather than two -- these are displayed and
    # edited as text, and a form has no way to submit NULL.
    #
    # Deliberately unvalidated beyond a length cap: Philippine mobile numbers
    # are written locally (09xx), internationally (+639xx) and with spacing
    # people expect to keep, and rejecting a number BFP could still dial would
    # be worse than storing it as typed.
    phone_number = models.CharField(max_length=32, blank=True)
    alternate_phone_number = models.CharField(max_length=32, blank=True)
