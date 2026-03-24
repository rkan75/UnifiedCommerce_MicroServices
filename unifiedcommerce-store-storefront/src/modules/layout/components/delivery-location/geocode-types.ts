export type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
  /** US ZIP when Nominatim returns it */
  postcode?: string
}
