from rest_framework.throttling import UserRateThrottle


class PlaceSearchThrottle(UserRateThrottle):
    scope = "place_search"

class PlaceDetailsThrottle(UserRateThrottle):
    scope = "place_details"

class ReverseGeocodeThrottle(UserRateThrottle):
    scope = "reverse_geocode"   

class NearbyLandmarksThrottle(UserRateThrottle):
    scope = "nearby_landmarks"