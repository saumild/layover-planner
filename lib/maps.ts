import {
  Client,
  TravelMode,
  PlacesNearbyRanking,
} from "@googlemaps/google-maps-services-js";

const client = new Client();

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AirportInfo {
  lat: number;
  lng: number;
  place_id: string;
  formatted_address: string;
}

export interface NearbyPlace {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  price_level?: number;
  open_now?: boolean;
  lat: number;
  lng: number;
  types: string[];
}

export interface PlaceDetails {
  name: string;
  formatted_address: string;
  rating?: number;
  price_level?: number;
  website?: string;
  phone?: string;
  open_now?: boolean;
}

export async function getAirportCoordinates(
  airportCode: string
): Promise<AirportInfo> {
  const response = await client.geocode({
    params: {
      address: `${airportCode} international airport`,
      key: apiKey(),
    },
  });

  const result = response.data.results[0];
  if (!result) throw new Error(`Could not find airport: ${airportCode}`);

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    place_id: result.place_id,
    formatted_address: result.formatted_address,
  };
}

export async function searchNearbyPlaces(
  location: Coordinates,
  placeTypes: string[],
  radius: number,
  maxPriceLevel: number
): Promise<NearbyPlace[]> {
  const results: NearbyPlace[] = [];
  const seen = new Set<string>();

  // Search up to 2 place types to avoid too many API calls
  for (const type of placeTypes.slice(0, 2)) {
    try {
      const response = await client.placesNearby({
        params: {
          location,
          radius,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: type as any,
          rankby: PlacesNearbyRanking.prominence,
          key: apiKey(),
        },
      });

      for (const place of response.data.results.slice(0, 8)) {
        if (!place.place_id || seen.has(place.place_id)) continue;
        if (
          place.price_level !== undefined &&
          place.price_level > maxPriceLevel
        )
          continue;
        if (place.opening_hours?.open_now === false) continue;

        seen.add(place.place_id);
        results.push({
          place_id: place.place_id,
          name: place.name ?? "Unknown",
          vicinity: place.vicinity ?? "",
          rating: place.rating,
          price_level: place.price_level,
          open_now: place.opening_hours?.open_now,
          lat: place.geometry?.location.lat ?? 0,
          lng: place.geometry?.location.lng ?? 0,
          types: place.types ?? [],
        });
      }
    } catch {
      // Continue with other types if one fails
    }
  }

  // Sort by rating descending
  return results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}

export async function getTravelTime(
  origin: Coordinates,
  destination: Coordinates,
  mode: "transit" | "driving" = "transit"
): Promise<number | null> {
  try {
    const response = await client.directions({
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: mode === "transit" ? TravelMode.transit : TravelMode.driving,
        key: apiKey(),
      },
    });

    const route = response.data.routes[0];
    if (!route) return null;
    const durationSeconds = route.legs[0].duration.value;
    return Math.ceil(durationSeconds / 60);
  } catch {
    return null;
  }
}

export async function getPlaceDetails(
  placeId: string
): Promise<PlaceDetails | null> {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          "name",
          "formatted_address",
          "rating",
          "price_level",
          "opening_hours",
          "website",
          "formatted_phone_number",
        ],
        key: apiKey(),
      },
    });

    const r = response.data.result;
    return {
      name: r.name ?? "",
      formatted_address: r.formatted_address ?? "",
      rating: r.rating,
      price_level: r.price_level,
      website: r.website,
      phone: r.formatted_phone_number,
      open_now: r.opening_hours?.open_now,
    };
  } catch {
    return null;
  }
}
