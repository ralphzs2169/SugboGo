from django.urls import path

from apps.msme.views.category_views import CategoryOptionsView
from apps.msme.views.cluster_views import ClusterOptionsView

from .views import MsmeDetailView, MsmeListView

urlpatterns = [
    
    path('', MsmeListView.as_view(), name='msme-list'),
    path('<int:MSME_ID>/', MsmeDetailView.as_view(), name='msme-detail'), 

    path('clusters/', ClusterOptionsView.as_view(), name='cluster-options'),
    path('categories/', CategoryOptionsView.as_view(), name='category-options'),
]