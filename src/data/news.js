// News data layer — real API calls.
import { api } from "../lib/api";

export const fetchNewsPosts = async (limit = 50) => (await api.get(`/news?limit=${limit}`)).posts;
export const fetchPostBySlug = async (slug) => (await api.get(`/news/${encodeURIComponent(slug)}`)).post;
