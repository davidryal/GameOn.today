import { default as nodeFetch } from 'node-fetch';

if (!process.env.OPENWEATHER_API_KEY) {
  throw new Error('OPENWEATHER_API_KEY environment variable is required');
}

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/';

export interface WeatherInfo {
  temperature: number;
  description: string;
  icon: string;
  precipitation: number;
}

async function getCoordinates(location: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await nodeFetch(
      `${BASE_URL}geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${API_KEY}`
    );
    const data = await response.json() as any[];

    if (!data || data.length === 0) {
      console.error(`No coordinates found for location: ${location}`);
      return null;
    }

    return {
      lat: data[0].lat,
      lon: data[0].lon
    };
  } catch (error) {
    console.error('Error fetching coordinates:', error);
    return null;
  }
}

export async function getWeatherForecast(location: string, date: Date): Promise<WeatherInfo | null> {
  try {
    const coords = await getCoordinates(location);
    if (!coords) return null;

    const response = await nodeFetch(
      `${BASE_URL}data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}&units=imperial`
    );
    const data = await response.json() as any;

    if (!data || !data.list) {
      console.error('No forecast data received');
      return null;
    }

    // Find the forecast closest to the game date
    const targetTime = date.getTime();
    const closestForecast = data.list.reduce((prev: any, curr: any) => {
      const prevDiff = Math.abs(new Date(prev.dt * 1000).getTime() - targetTime);
      const currDiff = Math.abs(new Date(curr.dt * 1000).getTime() - targetTime);
      return currDiff < prevDiff ? curr : prev;
    });

    return {
      temperature: closestForecast.main.temp,
      description: closestForecast.weather[0].description,
      icon: closestForecast.weather[0].icon,
      precipitation: closestForecast.pop * 100 // Convert to percentage
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}