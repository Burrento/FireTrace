from django.shortcuts import render
from django.http import HttpResponse
from django.views import View
from django.http import JsonResponse

def ping(request):
    return JsonResponse({"message": "Django says hello to React"})
    