use super::*;

pub(super) fn query_airport(
    connection: &Connection,
    airport_ident: &str,
) -> Result<Option<ProcedureAirport>> {
    connection
        .query_row(
            "
            select
              airport_id,
              ident,
              nullif(trim(icao), ''),
              name,
              lonx,
              laty
            from airport
            where ident = ?1 or coalesce(icao, '') = ?1
            limit 1
            ",
            params![airport_ident],
            |row| {
                Ok(ProcedureAirport {
                    id: row.get(0)?,
                    ident: row.get(1)?,
                    icao: row.get(2)?,
                    name: row
                        .get::<_, Option<String>>(3)?
                        .unwrap_or_else(|| "Unnamed Airport".to_string()),
                    location: LatLon {
                        lon: row.get(4)?,
                        lat: row.get(5)?,
                    },
                })
            },
        )
        .optional()
}

pub(super) fn query_airport_communications(
    connection: &Connection,
    airport_ident: &str,
) -> Result<Vec<AirportCommunication>> {
    let mut statement = connection.prepare(
        "
        select
          nullif(trim(c.type), ''),
          nullif(trim(c.name), ''),
          c.frequency
        from com c
        join airport ap on ap.airport_id = c.airport_id
        where
          ap.ident = ?1
          or coalesce(ap.icao, '') = ?1
        order by
          case
            when upper(coalesce(c.type, '')) = 'ATIS' then 0
            when upper(coalesce(c.type, '')) = 'A' then 1
            when upper(coalesce(c.type, '')) = 'D' then 2
            when upper(coalesce(c.type, '')) = 'C' then 3
            when upper(coalesce(c.type, '')) = 'T' then 4
            when upper(coalesce(c.type, '')) = 'G' then 5
            when upper(coalesce(c.type, '')) = 'RMP' then 6
            when upper(coalesce(c.type, '')) = 'OPS' then 7
            else 8
          end,
          c.frequency asc,
          coalesce(c.name, '') asc
        ",
    )?;

    let rows = statement.query_map(params![airport_ident], |row| {
        let service_type = row.get::<_, Option<String>>(0)?.unwrap_or_default();
        Ok((
            service_type,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;

    let mut communications = Vec::new();
    let mut seen = HashSet::new();

    for row in rows {
        let (raw_service_type, name, raw_frequency) = row?;
        let Some((service_type, label)) = map_airport_communication_type(&raw_service_type) else {
            continue;
        };

        let Some(frequency_mhz) = normalize_frequency_mhz(raw_frequency) else {
            continue;
        };

        let dedupe_key = format!(
            "{}:{}:{}",
            service_type,
            format!("{frequency_mhz:.3}"),
            name.as_deref().unwrap_or_default().trim().to_uppercase()
        );
        if !seen.insert(dedupe_key) {
            continue;
        }

        communications.push(AirportCommunication {
            service_type,
            label,
            name,
            frequency_mhz,
        });
    }

    Ok(communications)
}

pub(super) fn query_airport_runway_ends(
    connection: &Connection,
    airport_ident: &str,
) -> Result<Vec<AirportRunwayEnd>> {
    let mut statement = connection.prepare(
        "
        select
          end_name,
          reciprocal_name,
          heading_deg,
          length_ft,
          width_ft,
          surface,
          is_takeoff,
          is_landing,
          ils_ident,
          lonx,
          laty
        from (
          select
            primary_end.name as end_name,
            secondary_end.name as reciprocal_name,
            primary_end.heading as heading_deg,
            r.length as length_ft,
            r.width as width_ft,
            nullif(trim(r.surface), '') as surface,
            primary_end.is_takeoff as is_takeoff,
            primary_end.is_landing as is_landing,
            nullif(trim(primary_end.ils_ident), '') as ils_ident,
            primary_end.lonx as lonx,
            primary_end.laty as laty
          from runway r
          join airport ap on ap.airport_id = r.airport_id
          join runway_end primary_end on primary_end.runway_end_id = r.primary_end_id
          join runway_end secondary_end on secondary_end.runway_end_id = r.secondary_end_id
          where ap.ident = ?1 or coalesce(ap.icao, '') = ?1

          union all

          select
            secondary_end.name as end_name,
            primary_end.name as reciprocal_name,
            secondary_end.heading as heading_deg,
            r.length as length_ft,
            r.width as width_ft,
            nullif(trim(r.surface), '') as surface,
            secondary_end.is_takeoff as is_takeoff,
            secondary_end.is_landing as is_landing,
            nullif(trim(secondary_end.ils_ident), '') as ils_ident,
            secondary_end.lonx as lonx,
            secondary_end.laty as laty
          from runway r
          join airport ap on ap.airport_id = r.airport_id
          join runway_end primary_end on primary_end.runway_end_id = r.primary_end_id
          join runway_end secondary_end on secondary_end.runway_end_id = r.secondary_end_id
          where ap.ident = ?1 or coalesce(ap.icao, '') = ?1
        )
        order by length_ft desc, end_name asc
        ",
    )?;

    let rows = statement.query_map(params![airport_ident], |row| {
        Ok(AirportRunwayEnd {
            runway_name: row.get(0)?,
            reciprocal_runway_name: row.get(1)?,
            heading_deg: row.get(2)?,
            length_ft: row.get(3)?,
            width_ft: row.get(4)?,
            surface: row.get(5)?,
            is_takeoff: row.get::<_, i64>(6)? != 0,
            is_landing: row.get::<_, i64>(7)? != 0,
            ils_ident: row.get(8)?,
            location: LatLon {
                lon: row.get(9)?,
                lat: row.get(10)?,
            },
        })
    })?;

    let mut runway_ends = Vec::new();
    let mut seen = HashSet::new();
    for row in rows {
        let runway_end = row?;
        let dedupe_key = format!(
            "{}:{}:{:.4}:{:.6}:{:.6}",
            runway_end.runway_name,
            runway_end.reciprocal_runway_name,
            runway_end.heading_deg,
            runway_end.location.lat,
            runway_end.location.lon
        );
        if !seen.insert(dedupe_key) {
            continue;
        }
        runway_ends.push(runway_end);
    }

    Ok(runway_ends)
}

fn map_airport_communication_type(raw_type: &str) -> Option<(String, String)> {
    let normalized = raw_type.trim().to_uppercase();
    if normalized.is_empty() {
        return None;
    }

    let mapped = match normalized.as_str() {
        "ATIS" => ("atis", "ATIS"),
        "A" => ("app", "APP"),
        "D" => ("dep", "DEP"),
        "C" => ("clr", "CLR"),
        "T" => ("twr", "TWR"),
        "G" => ("gnd", "GND"),
        "RMP" => ("rmp", "RMP"),
        "OPS" => ("ops", "OPS"),
        "DIR" => ("dir", "DIR"),
        "CTA" => ("cta", "CTA"),
        "TCA" => ("tca", "TCA"),
        _ => {
            return Some((normalized.to_lowercase(), normalized));
        }
    };

    Some((mapped.0.to_string(), mapped.1.to_string()))
}

fn normalize_frequency_mhz(raw_frequency: i64) -> Option<f64> {
    if raw_frequency <= 0 {
        return None;
    }

    Some(raw_frequency as f64 / 1000.0)
}
