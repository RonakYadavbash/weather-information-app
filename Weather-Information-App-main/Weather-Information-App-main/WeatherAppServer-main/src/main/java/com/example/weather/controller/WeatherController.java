package com.example.weather.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // allow frontend calls during development
public class WeatherController {

    @Value("${openweathermap.key}")
    private String apiKey;

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    @GetMapping("/weather")
    public ResponseEntity<Object> getWeather(@RequestParam String city) {
        try {
            String apiUrl = "https://api.openweathermap.org/data/2.5/weather?q="
                    + java.net.URLEncoder.encode(city, StandardCharsets.UTF_8)
                    + "&appid=" + apiKey + "&units=metric";

            ResponseEntity<String> resp = rest.getForEntity(apiUrl, String.class);
            if (!resp.getStatusCode().is2xxSuccessful()) {
                return ResponseEntity.status(resp.getStatusCode()).body("Error from upstream API");
            }

            JsonNode root = mapper.readTree(resp.getBody());

            // Build a clean response
            JsonNode main = root.path("main");
            JsonNode sys = root.path("sys");
            JsonNode weatherArr = root.path("weather");
            String description = weatherArr.isArray() && weatherArr.size() > 0 ?
                    weatherArr.get(0).path("description").asText() : "";

            var result = mapper.createObjectNode();
            result.put("city", root.path("name").asText(""));
            result.put("description", description);
            result.put("temp", main.path("temp").asDouble());
            result.put("temp_min", main.path("temp_min").asDouble());
            result.put("temp_max", main.path("temp_max").asDouble());
            result.put("pressure", main.path("pressure").asInt());
            result.put("humidity", main.path("humidity").asInt());
            result.put("wind_speed", root.path("wind").path("speed").asDouble());
            result.put("sunrise", sys.path("sunrise").asLong());
            result.put("sunset", sys.path("sunset").asLong());

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching weather: " + e.getMessage());
        }
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(@RequestParam String city) {
        try {
            // Reuse the above endpoint logic by calling getWeather
            ResponseEntity<Object> weatherResp = getWeather(city);
            if (!weatherResp.getStatusCode().is2xxSuccessful()) {
                return ResponseEntity.status(weatherResp.getStatusCode()).body(null);
            }

            JsonNode data = mapper.convertValue(weatherResp.getBody(), JsonNode.class);

            // Build CSV in memory
            StringWriter sw = new StringWriter();
            sw.append("City,Description,Temp,MinTemp,MaxTemp,Pressure,Humidity,Wind,Sunrise,Sunset\n");

            long sunriseUnix = data.path("sunrise").asLong() * 1000L;
            long sunsetUnix = data.path("sunset").asLong() * 1000L;
            String sunrise = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date(sunriseUnix));
            String sunset = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date(sunsetUnix));

            sw.append(escapeCsv(data.path("city").asText())).append(",");
            sw.append(escapeCsv(data.path("description").asText())).append(",");
            sw.append(String.format("%.1f", data.path("temp").asDouble())).append(",");
            sw.append(String.format("%.1f", data.path("temp_min").asDouble())).append(",");
            sw.append(String.format("%.1f", data.path("temp_max").asDouble())).append(",");
            sw.append(String.valueOf(data.path("pressure").asInt())).append(",");
            sw.append(String.valueOf(data.path("humidity").asInt())).append(",");
            sw.append(String.valueOf(data.path("wind_speed").asDouble())).append(",");
            sw.append(sunrise).append(",").append(sunset).append("\n");

            byte[] csvBytes = sw.toString().getBytes(StandardCharsets.UTF_8);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
            headers.setContentDisposition(ContentDisposition.builder("attachment")
                    .filename(city + "-weather.csv").build());

            return new ResponseEntity<>(csvBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    private String escapeCsv(String v) {
        if (v == null) return "";
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) {
            v = v.replace("\"", "\"\"");
            return "\"" + v + "\"";
        }
        return v;
    }
}
