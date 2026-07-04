"""
URL configuration for sugbogo_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/users/', include('apps.users.urls')),
    # path('merchant/', include('apps.merchant_operations.urls')),


    # Admin Operations
    path('api/msme/', include('apps.admin_operations.msme_management.urls')),
    path('api/user-management/', include('apps.admin_operations.user_management.urls')),
    path('api/landmark-management/', include('apps.admin_operations.landmark_management.urls')),
    path('api/tag-management/', include('apps.admin_operations.tag_management.urls')),
    path('api/content-management/', include('apps.admin_operations.content_management.urls')),

    path('api/role-management/', include('apps.admin_operations.role_management.urls')),
    path('api/suspicious-activity/', include('apps.admin_operations.suspicious_activity.urls')),
    path('api/analytics/', include('apps.admin_operations.analytics.urls')),

    path('api/system-configuration/', include('apps.admin_operations.system_configuration.urls')),

]
