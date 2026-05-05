use super::*;

pub(super) fn physical_runway_count(runway_ends: &[AirportRunwayEnd]) -> usize {
    runway_ends
        .iter()
        .map(|runway| {
            canonical_runway_pair_key(&runway.runway_name, &runway.reciprocal_runway_name)
        })
        .collect::<HashSet<_>>()
        .len()
}

pub(super) fn select_active_runways(
    runway_ends: &[AirportRunwayEnd],
    parsed_wind: &ParsedWind,
    operation: AtisOperation,
) -> Vec<AirportRunwayEnd> {
    let mut candidates = runway_ends
        .iter()
        .filter(|runway| runway_supports_operation(runway, operation))
        .cloned()
        .collect::<Vec<_>>();

    if candidates.is_empty() {
        candidates = runway_ends.to_vec();
    }
    if candidates.is_empty() {
        return Vec::new();
    }

    let anchor = candidates
        .iter()
        .max_by(|left, right| {
            runway_anchor_score(left, parsed_wind, operation)
                .total_cmp(&runway_anchor_score(right, parsed_wind, operation))
                .then_with(|| left.length_ft.total_cmp(&right.length_ft))
                .then_with(|| left.runway_name.cmp(&right.runway_name))
        })
        .cloned()
        .unwrap_or_else(|| candidates[0].clone());

    let family = candidates
        .into_iter()
        .filter(|runway| {
            heading_difference_deg(runway.heading_deg, anchor.heading_deg)
                <= PARALLEL_HEADING_TOLERANCE_DEG
        })
        .collect::<Vec<_>>();

    let selected = apply_parallel_runway_rules(family, operation);
    if selected.is_empty() {
        vec![anchor]
    } else {
        selected
    }
}

pub(super) fn apply_parallel_runway_rules(
    mut runway_family: Vec<AirportRunwayEnd>,
    operation: AtisOperation,
) -> Vec<AirportRunwayEnd> {
    if runway_family.len() <= 2 {
        return runway_family;
    }

    let mean_heading = average_heading(
        &runway_family
            .iter()
            .map(|runway| runway.heading_deg)
            .collect::<Vec<_>>(),
    );
    let mean_lat = runway_family
        .iter()
        .map(|runway| runway.location.lat)
        .sum::<f64>()
        / runway_family.len() as f64;
    let mean_lon = runway_family
        .iter()
        .map(|runway| runway.location.lon)
        .sum::<f64>()
        / runway_family.len() as f64;
    let cos_lat = mean_lat.to_radians().cos();
    let heading_radians = mean_heading.to_radians();
    let perp_x = heading_radians.cos();
    let perp_y = -heading_radians.sin();

    runway_family.sort_by(|left, right| {
        lateral_position(left, mean_lon, cos_lat, perp_x, perp_y)
            .total_cmp(&lateral_position(right, mean_lon, cos_lat, perp_x, perp_y))
            .then_with(|| left.runway_name.cmp(&right.runway_name))
    });

    match operation {
        AtisOperation::Arrival => {
            vec![
                runway_family.first().cloned().unwrap(),
                runway_family.last().cloned().unwrap(),
            ]
        }
        AtisOperation::Departure => runway_family[1..runway_family.len() - 1].to_vec(),
    }
}

pub(super) fn parse_wind(metar: &MetarObservation) -> ParsedWind {
    let raw_text = metar.raw_text.to_uppercase();
    let raw_tokens = raw_text.split_whitespace().collect::<Vec<_>>();
    let mut variable_from_deg = None;
    let mut variable_to_deg = None;

    for window in raw_tokens.windows(3) {
        if let [from, "V", to] = window {
            if from.len() == 3 && to.len() == 3 {
                variable_from_deg = from.parse::<i64>().ok();
                variable_to_deg = to.parse::<i64>().ok();
                break;
            }
        }
    }

    let token_parse = raw_tokens.iter().find_map(|token| parse_wind_token(token));
    let direction_deg = token_parse
        .as_ref()
        .and_then(|parsed| parsed.direction_deg)
        .or_else(|| {
            metar
                .wind_direction
                .as_deref()
                .map(str::trim)
                .and_then(|value| match value.to_uppercase().as_str() {
                    "VRB" | "VAR" => None,
                    _ => value.parse::<i64>().ok(),
                })
        });
    let speed = token_parse
        .as_ref()
        .and_then(|parsed| parsed.speed)
        .or(metar.wind_speed_kt);
    let gust = token_parse
        .as_ref()
        .and_then(|parsed| parsed.gust)
        .or(metar.wind_gust_kt);
    let unit = token_parse
        .as_ref()
        .map(|parsed| parsed.unit)
        .unwrap_or(WindUnit::Knots);

    ParsedWind {
        direction_deg,
        speed,
        gust,
        unit,
        variable_from_deg,
        variable_to_deg,
    }
}

pub(super) fn merged_runway_names(
    arrival_runways: &[AirportRunwayEnd],
    departure_runways: &[AirportRunwayEnd],
) -> Vec<String> {
    let mut merged = Vec::new();
    let mut seen = HashSet::new();

    for runway_name in arrival_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .chain(
            departure_runways
                .iter()
                .map(|runway| runway.runway_name.clone()),
        )
    {
        if seen.insert(runway_name.clone()) {
            merged.push(runway_name);
        }
    }

    merged
}

pub(super) fn runway_name_sets_match(left: &[String], right: &[String]) -> bool {
    if left.is_empty() || right.is_empty() {
        return false;
    }

    let left_set = left.iter().cloned().collect::<HashSet<_>>();
    let right_set = right.iter().cloned().collect::<HashSet<_>>();
    left_set == right_set
}

pub(super) fn normalize_speed_to_knots(value: i64, unit: WindUnit) -> f64 {
    match unit {
        WindUnit::Knots => value as f64,
        WindUnit::MetersPerSecond => value as f64 * MPS_TO_KT,
    }
}

fn lateral_position(
    runway: &AirportRunwayEnd,
    mean_lon: f64,
    cos_lat: f64,
    perp_x: f64,
    perp_y: f64,
) -> f64 {
    let east = (runway.location.lon - mean_lon) * cos_lat;
    let north = runway.location.lat;
    east * perp_x + north * perp_y
}

fn runway_anchor_score(
    runway: &AirportRunwayEnd,
    parsed_wind: &ParsedWind,
    operation: AtisOperation,
) -> f64 {
    let mut score = runway.length_ft / 1000.0;
    if matches!(operation, AtisOperation::Arrival) && runway.ils_ident.is_some() {
        score += 2.5;
    }

    if let Some(headwind_component) = headwind_component(runway.heading_deg, parsed_wind) {
        if headwind_component >= 0.0 {
            score += headwind_component * 4.0;
        } else {
            score += headwind_component * 8.0;
        }
    }

    score
}

fn runway_supports_operation(runway: &AirportRunwayEnd, operation: AtisOperation) -> bool {
    match operation {
        AtisOperation::Departure => runway.is_takeoff,
        AtisOperation::Arrival => runway.is_landing,
    }
}

fn headwind_component(runway_heading_deg: f64, parsed_wind: &ParsedWind) -> Option<f64> {
    let wind_direction = parsed_wind.direction_deg?;
    let wind_speed = parsed_wind
        .speed
        .map(|speed| normalize_speed_to_knots(speed, parsed_wind.unit))?;
    if wind_speed <= LIGHT_AND_VARIABLE_WIND_KT as f64 {
        return None;
    }

    let delta_radians =
        heading_difference_deg(runway_heading_deg, wind_direction as f64).to_radians();
    Some(wind_speed * delta_radians.cos())
}

fn parse_wind_token(token: &str) -> Option<ParsedWind> {
    let normalized = token.trim().to_uppercase();
    let (body, unit) = if let Some(body) = normalized.strip_suffix("KT") {
        (body, WindUnit::Knots)
    } else if let Some(body) = normalized.strip_suffix("MPS") {
        (body, WindUnit::MetersPerSecond)
    } else {
        return None;
    };

    if body.len() < 5 {
        return None;
    }

    let direction_text = &body[..3];
    let rest = &body[3..];
    let direction_deg = match direction_text {
        "VRB" | "VAR" => None,
        _ => direction_text.parse::<i64>().ok(),
    };
    let (speed_text, gust_text) = if let Some((speed_text, gust_text)) = rest.split_once('G') {
        (speed_text, Some(gust_text))
    } else {
        (rest, None)
    };
    let speed = speed_text.parse::<i64>().ok();
    let gust = gust_text.and_then(|value| value.parse::<i64>().ok());

    Some(ParsedWind {
        direction_deg,
        speed,
        gust,
        unit,
        variable_from_deg: None,
        variable_to_deg: None,
    })
}

fn average_heading(headings: &[f64]) -> f64 {
    let (sin_sum, cos_sum) = headings
        .iter()
        .fold((0.0, 0.0), |(sin_sum, cos_sum), heading| {
            let radians = heading.to_radians();
            (sin_sum + radians.sin(), cos_sum + radians.cos())
        });

    if sin_sum == 0.0 && cos_sum == 0.0 {
        0.0
    } else {
        sin_sum.atan2(cos_sum).to_degrees().rem_euclid(360.0)
    }
}

fn heading_difference_deg(left: f64, right: f64) -> f64 {
    let difference = (left - right).rem_euclid(360.0);
    difference.min(360.0 - difference)
}

fn canonical_runway_pair_key(runway_name: &str, reciprocal_runway_name: &str) -> String {
    if runway_name <= reciprocal_runway_name {
        format!("{runway_name}|{reciprocal_runway_name}")
    } else {
        format!("{reciprocal_runway_name}|{runway_name}")
    }
}
