use super::*;

pub(super) fn infer_runway_condition_sentence(metar: &MetarObservation) -> Option<String> {
    let weather = metar.weather.as_deref()?.to_uppercase();
    if weather.contains("RA")
        || weather.contains("DZ")
        || weather.contains("SN")
        || weather.contains("SH")
    {
        Some("Runway surface wet.".to_string())
    } else {
        None
    }
}

pub(super) fn format_wind_sentence(parsed_wind: &ParsedWind) -> Option<String> {
    let speed = parsed_wind.speed?;
    let direction = parsed_wind.direction_deg;

    let wind_unit = match parsed_wind.unit {
        WindUnit::Knots => "KT",
        WindUnit::MetersPerSecond => "MPS",
    };

    let mut text = if let Some(direction) = direction {
        format!("Wind {:03} degrees at {} {}", direction, speed, wind_unit)
    } else {
        format!("Wind variable {} {}", speed, wind_unit)
    };

    if let Some(gust) = parsed_wind.gust {
        let gust_keyword = match parsed_wind.unit {
            WindUnit::Knots => "maximum",
            WindUnit::MetersPerSecond => "gust",
        };
        text.push_str(&format!(" {gust_keyword} {}", gust));
    }

    Some(format!("{text}."))
}

pub(super) fn format_variable_wind_sentence(parsed_wind: &ParsedWind) -> Option<String> {
    let from_deg = parsed_wind.variable_from_deg?;
    let to_deg = parsed_wind.variable_to_deg?;
    Some(format!(
        "Direction variable between {:03} and {:03}.",
        from_deg, to_deg
    ))
}

pub(super) fn format_visibility_sentence(metar: &MetarObservation) -> Option<String> {
    let measure = parse_visibility_measure(metar)?;
    Some(format_visibility_measure(measure))
}

pub(super) fn format_weather_sentence(metar: &MetarObservation) -> Option<String> {
    let weather = metar.weather.as_deref()?.trim();
    if weather.is_empty() {
        return None;
    }
    Some(format!("{}.", decode_weather_string(weather)))
}

pub(super) fn format_clouds_sentence(metar: &MetarObservation) -> Option<String> {
    let mut parts = metar
        .clouds
        .iter()
        .map(format_cloud_layer_spoken)
        .collect::<Vec<_>>();

    if let Some(vertical_visibility_ft) = metar.vertical_visibility_ft {
        let meters = (vertical_visibility_ft as f64 * FEET_TO_METERS).round() as i64;
        parts.push(format!(
            "Vertical visibility {} meters",
            number_to_atis(meters)
        ));
    }

    if parts.is_empty() {
        return None;
    }

    Some(format!("Clouds {}.", parts.join(". ")))
}

pub(super) fn format_temperature_sentence(metar: &MetarObservation) -> Option<String> {
    match (metar.temperature_c, metar.dewpoint_c) {
        (Some(temperature), Some(dewpoint)) => Some(format!(
            "Temperature {}, dew point {}.",
            temperature.round() as i64,
            dewpoint.round() as i64
        )),
        (Some(temperature), None) => Some(format!("Temperature {}.", temperature.round() as i64)),
        _ => None,
    }
}

pub(super) fn format_pressure_sentence(
    metar: &MetarObservation,
    overview: &AirportWeatherOverviewResponse,
) -> Option<String> {
    let (pressure_unit, reported_qnh) = parse_reported_pressure(metar)
        .or_else(|| metar.altimeter_hpa.map(|value| (PressureUnit::Hpa, value)))?;
    let qnh_hpa = pressure_to_hpa(reported_qnh, pressure_unit);
    let qfe_hpa = overview
        .airport
        .as_ref()
        .and_then(|airport| airport.elevation_ft)
        .map(|elevation_ft| qnh_hpa - elevation_ft * 0.035);
    let qnh_display = format_pressure_value(reported_qnh, pressure_unit);
    let unit_label = pressure_unit_label(pressure_unit);

    if let Some(qfe_hpa) = qfe_hpa.filter(|qfe_hpa| (qnh_hpa - *qfe_hpa).abs() >= 2.0) {
        let qfe_display =
            format_pressure_value(pressure_from_hpa(qfe_hpa, pressure_unit), pressure_unit);
        Some(format!(
            "QFE {} {}, QNH {} {}.",
            qfe_display, unit_label, qnh_display, unit_label
        ))
    } else {
        Some(format!("QNH {} {}.", qnh_display, unit_label))
    }
}

pub(super) fn format_trend_sentence(overview: &AirportWeatherOverviewResponse) -> Option<String> {
    let taf = overview.taf.as_ref()?;
    let segment = taf.forecast_segments.iter().find(|segment| {
        segment
            .change_type
            .as_deref()
            .map(|value| value.eq_ignore_ascii_case("TEMPO"))
            .unwrap_or(false)
    })?;
    format_taf_segment_trend(segment)
}

fn format_cloud_layer_spoken(layer: &WeatherCloudLayer) -> String {
    let cover = decode_cloud_cover(&layer.cover);
    let cloud_type = infer_cloud_shape_label(layer);
    match layer.base_ft {
        Some(base_ft) => {
            let base_spoken = altitude_ft_to_spoken(base_ft);
            if let Some(cloud_type) = cloud_type {
                format!("{cover} {base_spoken} {cloud_type}")
            } else {
                format!("{cover} {base_spoken}")
            }
        }
        None => {
            if let Some(cloud_type) = cloud_type {
                format!("{cover} {cloud_type}")
            } else {
                cover.to_string()
            }
        }
    }
}

fn infer_cloud_shape_label(layer: &WeatherCloudLayer) -> Option<&'static str> {
    let cover = layer.cover.to_uppercase();
    if cover.contains("CB") {
        Some("cumulonimbus")
    } else if cover.contains("TCU") {
        Some("towering cumulus")
    } else {
        None
    }
}

fn decode_cloud_cover(raw_cover: &str) -> &'static str {
    let normalized = raw_cover.to_uppercase();
    if normalized.starts_with("FEW") {
        "Few"
    } else if normalized.starts_with("SCT") {
        "Scattered"
    } else if normalized.starts_with("BKN") {
        "Broken"
    } else if normalized.starts_with("OVC") {
        "Overcast"
    } else if normalized.starts_with("VV") {
        "Vertical visibility"
    } else {
        "Clouds"
    }
}

fn altitude_ft_to_spoken(base_ft: i64) -> String {
    if base_ft < 10_000 {
        let thousands = base_ft / 1000;
        let hundreds = (base_ft % 1000) / 100;
        match (thousands, hundreds) {
            (0, 0) => "zero".to_string(),
            (0, hundreds) => format!("{} hundred", number_to_atis(hundreds)),
            (thousands, 0) => format!("{} thousand", number_to_atis(thousands)),
            (thousands, hundreds) => format!(
                "{} thousand {} hundred",
                number_to_atis(thousands),
                number_to_atis(hundreds)
            ),
        }
    } else {
        let thousands = base_ft / 1000;
        format!("{} thousand", number_to_atis(thousands))
    }
}

fn format_taf_segment_trend(segment: &TafForecastSegment) -> Option<String> {
    let mut parts = vec!["Tempo".to_string()];

    if let Some(visibility) = segment
        .visibility_sm
        .as_deref()
        .and_then(parse_visibility_from_awc_field)
    {
        parts.push(format!(
            "visibility {}",
            visibility_measure_text(visibility)
        ));
    }

    if let Some(weather) = segment.weather.as_deref() {
        parts.push(decode_weather_string(weather));
    }

    if parts.len() == 1 {
        None
    } else {
        Some(format!("{}.", parts.join(", ")))
    }
}

fn decode_weather_string(raw_weather: &str) -> String {
    let normalized = raw_weather.trim().to_uppercase();
    if normalized.is_empty() {
        return "Weather unavailable".to_string();
    }

    normalized
        .split_whitespace()
        .map(decode_weather_token)
        .collect::<Vec<_>>()
        .join(", ")
}

fn decode_weather_token(token: &str) -> String {
    let mut remaining = token.trim().to_uppercase();
    let intensity = if let Some(stripped) = remaining.strip_prefix('+') {
        remaining = stripped.to_string();
        Some("Heavy")
    } else if let Some(stripped) = remaining.strip_prefix('-') {
        remaining = stripped.to_string();
        Some("Light")
    } else {
        None
    };

    let mut pieces = Vec::new();
    if remaining.contains("SH") {
        pieces.push("Showers");
        remaining = remaining.replace("SH", "");
    }
    if remaining.contains("TS") {
        pieces.push("Thunderstorm");
        remaining = remaining.replace("TS", "");
    }
    if remaining.contains("RA") {
        pieces.push("Rain");
        remaining = remaining.replace("RA", "");
    }
    if remaining.contains("DZ") {
        pieces.push("Drizzle");
        remaining = remaining.replace("DZ", "");
    }
    if remaining.contains("SN") {
        pieces.push("Snow");
        remaining = remaining.replace("SN", "");
    }
    if remaining.contains("FG") {
        pieces.push("Fog");
        remaining = remaining.replace("FG", "");
    }
    if remaining.contains("BR") {
        pieces.push("Mist");
        remaining = remaining.replace("BR", "");
    }
    if remaining.contains("HZ") {
        pieces.push("Haze");
    }

    if pieces.is_empty() {
        return token.to_string();
    }

    let weather_text = pieces.join(" ");
    match intensity {
        Some(intensity) => format!("{intensity} {weather_text}"),
        None => weather_text,
    }
}

fn parse_reported_pressure(metar: &MetarObservation) -> Option<(PressureUnit, f64)> {
    metar.raw_text.split_whitespace().find_map(|token| {
        let token = token.trim().to_uppercase();

        if let Some(value) = token.strip_prefix('Q') {
            if value.len() == 4 && value.chars().all(|character| character.is_ascii_digit()) {
                return value
                    .parse::<f64>()
                    .ok()
                    .map(|parsed| (PressureUnit::Hpa, parsed));
            }
        }

        if let Some(value) = token.strip_prefix('A') {
            if value.len() == 4 && value.chars().all(|character| character.is_ascii_digit()) {
                return value
                    .parse::<f64>()
                    .ok()
                    .map(|parsed| (PressureUnit::InHg, parsed / 100.0));
            }
        }

        None
    })
}

fn pressure_to_hpa(value: f64, unit: PressureUnit) -> f64 {
    match unit {
        PressureUnit::Hpa => value,
        PressureUnit::InHg => value / HPA_TO_INHG,
    }
}

fn pressure_from_hpa(value: f64, unit: PressureUnit) -> f64 {
    match unit {
        PressureUnit::Hpa => value,
        PressureUnit::InHg => value * HPA_TO_INHG,
    }
}

fn format_pressure_value(value: f64, unit: PressureUnit) -> String {
    match unit {
        PressureUnit::Hpa => format!("{}", value.round() as i64),
        PressureUnit::InHg => format!("{value:.2}"),
    }
}

fn pressure_unit_label(unit: PressureUnit) -> &'static str {
    match unit {
        PressureUnit::Hpa => "HPa",
        PressureUnit::InHg => "InHg",
    }
}

fn parse_visibility_measure(metar: &MetarObservation) -> Option<VisibilityMeasure> {
    parse_visibility_from_raw_text(&metar.raw_text).or_else(|| {
        metar
            .visibility_sm
            .as_deref()
            .and_then(parse_visibility_from_awc_field)
    })
}

fn parse_visibility_from_raw_text(raw_text: &str) -> Option<VisibilityMeasure> {
    let upper = raw_text.to_uppercase();
    let tokens = upper.split_whitespace().collect::<Vec<_>>();

    for (index, token) in tokens.iter().enumerate() {
        if *token == "CAVOK" || *token == "9999" {
            return Some(VisibilityMeasure::Unlimited);
        }

        if token.starts_with('R') && token.contains('/') {
            continue;
        }

        if token.len() == 4 && token.chars().all(|character| character.is_ascii_digit()) {
            return token.parse::<i64>().ok().map(VisibilityMeasure::Meters);
        }

        if let Some(statute_miles) = parse_statute_miles_token(&tokens, index) {
            return Some(statute_miles);
        }
    }

    None
}

fn parse_visibility_from_awc_field(value: &str) -> Option<VisibilityMeasure> {
    let normalized = value.trim().to_uppercase();
    if normalized.is_empty() {
        return None;
    }

    if normalized == "10+" || normalized == "P6" || normalized == "P6SM" || normalized == "6+" {
        return Some(VisibilityMeasure::Unlimited);
    }

    if normalized == "9999" {
        return Some(VisibilityMeasure::Unlimited);
    }

    if normalized.len() == 4
        && normalized
            .chars()
            .all(|character| character.is_ascii_digit())
    {
        return normalized
            .parse::<i64>()
            .ok()
            .map(VisibilityMeasure::Meters);
    }

    if normalized.ends_with("SM") || normalized.contains('/') || normalized.contains('.') {
        return parse_statute_miles_token(&[normalized.as_str()], 0);
    }

    if let Ok(sm) = normalized.parse::<f64>() {
        return Some(VisibilityMeasure::StatuteMiles(sm));
    }

    None
}

fn parse_statute_miles_token(tokens: &[&str], index: usize) -> Option<VisibilityMeasure> {
    let token = *tokens.get(index)?;
    let body = token.strip_suffix("SM")?;

    if let Some(value) = body.strip_prefix('P') {
        let sm = parse_fractional_number(value)?;
        return if sm >= 6.0 {
            Some(VisibilityMeasure::Unlimited)
        } else {
            Some(VisibilityMeasure::StatuteMiles(sm))
        };
    }

    if let Some(previous) = index
        .checked_sub(1)
        .and_then(|position| tokens.get(position))
    {
        if previous.chars().all(|character| character.is_ascii_digit()) && body.contains('/') {
            let whole = previous.parse::<f64>().ok()?;
            let fraction = parse_fractional_number(body)?;
            return Some(VisibilityMeasure::StatuteMiles(whole + fraction));
        }
    }

    parse_fractional_number(body).map(VisibilityMeasure::StatuteMiles)
}

fn parse_fractional_number(value: &str) -> Option<f64> {
    let normalized = value.trim().trim_start_matches('M');
    if let Some((numerator, denominator)) = normalized.split_once('/') {
        let numerator = numerator.parse::<f64>().ok()?;
        let denominator = denominator.parse::<f64>().ok()?;
        if denominator.abs() < f64::EPSILON {
            return None;
        }
        Some(numerator / denominator)
    } else {
        normalized.parse::<f64>().ok()
    }
}

fn format_visibility_measure(measure: VisibilityMeasure) -> String {
    format!("Visibility {}.", visibility_measure_text(measure))
}

fn visibility_measure_text(measure: VisibilityMeasure) -> String {
    match measure {
        VisibilityMeasure::Unlimited => "10 km or more".to_string(),
        VisibilityMeasure::Meters(meters) => {
            if meters >= 10_000 {
                "10 km or more".to_string()
            } else if meters >= 6_000 {
                format!("{} km", round_visibility_km(meters as f64 / 1000.0))
            } else {
                format!("{:04} meters", round_visibility_meters(meters))
            }
        }
        VisibilityMeasure::StatuteMiles(statute_miles) => {
            let kilometers = statute_miles * MILES_TO_KM;
            if kilometers >= 10.0 {
                "10 km or more".to_string()
            } else if kilometers >= 6.0 {
                format!("{} km", round_visibility_km(kilometers))
            } else {
                let meters = (statute_miles * MILES_TO_METERS).round() as i64;
                format!("{:04} meters", round_visibility_meters(meters))
            }
        }
    }
}

fn round_visibility_km(kilometers: f64) -> i64 {
    kilometers.round() as i64
}

fn round_visibility_meters(meters: i64) -> i64 {
    ((meters + 50) / 100) * 100
}

fn number_to_atis(value: i64) -> String {
    if value < 0 {
        return format!("minus {}", number_to_atis(-value));
    }

    value
        .to_string()
        .chars()
        .map(digit_to_word)
        .collect::<Vec<_>>()
        .join(" ")
}

fn digit_to_word(digit: char) -> &'static str {
    match digit {
        '0' => "zero",
        '1' => "one",
        '2' => "two",
        '3' => "three",
        '4' => "four",
        '5' => "five",
        '6' => "six",
        '7' => "seven",
        '8' => "eight",
        '9' => "niner",
        _ => "",
    }
}
