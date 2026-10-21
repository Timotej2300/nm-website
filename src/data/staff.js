// Staff data layer — real API call. Roster is managed in the admin panel.
import { api } from "../lib/api";

export const fetchStaff = () => api.get("/staff"); // { tiers, members }
