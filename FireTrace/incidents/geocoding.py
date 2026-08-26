"""Geocoding confidence grading.

Confidence is derived from *how the coordinate was captured*, which is
information the report wizard already has, rather than from a second call to
the Geocoding API. A pin the reporter placed themselves is treated as the
strongest signal: they were standing there and could see the fire.

Only HIGH and MEDIUM records are plotted as precise points on the operations
map. LOW records still exist, are still reviewable, and still appear in the
queue -- they are simply not drawn at a coordinate the data cannot support.
"""

from django.conf import settings

from .models import GeocodingConfidence, LocationSource


def _accuracy_bands():
    return (
        getattr(settings, 'GEO_HIGH_ACCURACY_M', 50),
        getattr(settings, 'GEO_MEDIUM_ACCURACY_M', 200),
    )


def derive_confidence(location_source, gps_accuracy_m=None, has_coordinates=True):
    """Grade a captured location as high / medium / low confidence."""
    if not has_coordinates:
        return GeocodingConfidence.LOW

    high_band, medium_band = _accuracy_bands()

    if location_source == LocationSource.MAP_PIN:
        return GeocodingConfidence.HIGH

    if location_source == LocationSource.DEVICE_GPS:
        if gps_accuracy_m is None:
            # A real satellite fix with an unreported radius: good enough to
            # map, not good enough to call exact.
            return GeocodingConfidence.MEDIUM
        if gps_accuracy_m <= high_band:
            return GeocodingConfidence.HIGH
        if gps_accuracy_m <= medium_band:
            return GeocodingConfidence.MEDIUM
        return GeocodingConfidence.LOW

    if location_source == LocationSource.GEOCODED_ADDRESS:
        return GeocodingConfidence.MEDIUM

    # BARANGAY_ONLY, or anything unrecognised: the point is a centroid, not a
    # location, so it must not be drawn as one.
    return GeocodingConfidence.LOW
