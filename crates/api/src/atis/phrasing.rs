use super::*;

pub(super) fn derive_information_code(metar: &MetarObservation) -> String {
    let Some(observed_at_unix) = metar.observed_at_unix else {
        return NATO_INFORMATION_CODES[0].to_string();
    };
    let Some(timestamp) = Utc.timestamp_opt(observed_at_unix, 0).single() else {
        return NATO_INFORMATION_CODES[0].to_string();
    };

    let cycle_index =
        (timestamp.ordinal0() * 48 + timestamp.hour() * 2 + u32::from(timestamp.minute() >= 30))
            % NATO_INFORMATION_CODES.len() as u32;
    NATO_INFORMATION_CODES[cycle_index as usize].to_string()
}

pub(super) fn derive_issued_at_digits(metar: &MetarObservation) -> Option<String> {
    let observed_at_unix = metar.observed_at_unix?;
    let timestamp = Utc.timestamp_opt(observed_at_unix, 0).single()?;
    Some(format!("{:02}{:02}Z", timestamp.hour(), timestamp.minute()))
}

pub(super) fn normalize_airport_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "Airport".to_string();
    }
    trimmed.to_string()
}

pub(super) fn format_expected_approach(arrival_runways: &[AirportRunwayEnd]) -> Option<String> {
    let primary_runway = arrival_runways.first()?;
    if primary_runway.ils_ident.is_some() {
        Some(format!(
            "ILS Runway {} approach.",
            primary_runway.runway_name
        ))
    } else {
        Some(format!(
            "Expected approach Runway {}.",
            primary_runway.runway_name
        ))
    }
}

pub(super) fn format_runway_use_sentence(
    arrival_runways: &[AirportRunwayEnd],
    departure_runways: &[AirportRunwayEnd],
    mode: ReportMode,
) -> Option<String> {
    let arrival_names = arrival_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();
    let departure_names = departure_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();
    let has_same_runway_assignment = runway_name_sets_match(&arrival_names, &departure_names);

    match mode {
        ReportMode::Combined => {
            if arrival_names.is_empty() && departure_names.is_empty() {
                None
            } else if has_same_runway_assignment {
                Some(format!(
                    "Runway {} in use.",
                    join_runway_phrase(if !arrival_names.is_empty() {
                        &arrival_names
                    } else {
                        &departure_names
                    })
                ))
            } else if arrival_names.is_empty() {
                Some(format!(
                    "Departure Runway {}.",
                    join_runway_phrase(&departure_names)
                ))
            } else if departure_names.is_empty() {
                Some(format!(
                    "Landing Runway {}.",
                    join_runway_phrase(&arrival_names)
                ))
            } else {
                Some(format!(
                    "Landing Runway {}, Departure Runway {}.",
                    join_runway_phrase(&arrival_names),
                    join_runway_phrase(&departure_names)
                ))
            }
        }
        ReportMode::Arrival => {
            if arrival_names.is_empty() && departure_names.is_empty() {
                None
            } else if departure_names.is_empty() || has_same_runway_assignment {
                Some(format!(
                    "Landing Runway {}.",
                    join_runway_phrase(&arrival_names)
                ))
            } else {
                Some(format!(
                    "Landing Runway {}, Departure Runway {}.",
                    join_runway_phrase(&arrival_names),
                    join_runway_phrase(&departure_names)
                ))
            }
        }
        ReportMode::Departure => {
            if departure_names.is_empty() && arrival_names.is_empty() {
                None
            } else if arrival_names.is_empty() || has_same_runway_assignment {
                Some(format!(
                    "Departure Runway {}.",
                    join_runway_phrase(&departure_names)
                ))
            } else {
                Some(format!(
                    "Departure Runway {}, Landing Runway {}.",
                    join_runway_phrase(&departure_names),
                    join_runway_phrase(&arrival_names)
                ))
            }
        }
    }
}

pub(super) fn format_frequency_notice(
    contacts: &[AirportCommunication],
    active_runways: &[AirportRunwayEnd],
    mode: ReportMode,
) -> Option<String> {
    if contacts.is_empty() {
        return None;
    }

    if matches!(mode, ReportMode::Arrival) {
        return None;
    }

    let runway_names = active_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();

    if runway_names.is_empty() {
        return Some(format!(
            "Departure Frequency {}.",
            join_contact_short_list(contacts)
        ));
    }

    Some(format!(
        "Departure Frequency {}.",
        assign_contacts_to_runways(contacts, &runway_names)
    ))
}

pub(super) fn select_contacts(
    communications: &[AirportCommunication],
    operation: AtisOperation,
) -> Vec<AirportCommunication> {
    let mut contacts = Vec::new();

    match operation {
        AtisOperation::Departure => {
            contacts.extend(pick_contacts(communications, &["dep"], 2));
            if contacts.is_empty() {
                contacts.extend(pick_contacts(communications, &["app"], 2));
            }
            if contacts.is_empty() {
                contacts.extend(pick_contacts(communications, &["twr"], 2));
            }
        }
        AtisOperation::Arrival => {
            contacts.extend(pick_contacts(communications, &["app"], 2));
            if contacts.is_empty() {
                contacts.extend(pick_contacts(communications, &["dep"], 2));
            }
        }
    }

    dedupe_contacts(contacts)
}

fn assign_contacts_to_runways(
    contacts: &[AirportCommunication],
    runway_names: &[String],
) -> String {
    if contacts.is_empty() {
        return String::new();
    }

    if contacts.len() == 1 {
        return format!("{:.3}", contacts[0].frequency_mhz);
    }

    runway_names
        .iter()
        .enumerate()
        .map(|(index, runway_name)| {
            let contact = &contacts[index.min(contacts.len() - 1)];
            format!("{:.3} Runway {}", contact.frequency_mhz, runway_name)
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn join_contact_short_list(contacts: &[AirportCommunication]) -> String {
    contacts
        .iter()
        .map(|contact| format!("{:.3}", contact.frequency_mhz))
        .collect::<Vec<_>>()
        .join(", ")
}

fn pick_contacts(
    communications: &[AirportCommunication],
    service_types: &[&str],
    limit: usize,
) -> Vec<AirportCommunication> {
    for service_type in service_types {
        let matching = communications
            .iter()
            .filter(|entry| entry.service_type == *service_type)
            .take(limit)
            .cloned()
            .collect::<Vec<_>>();
        if !matching.is_empty() {
            return matching;
        }
    }

    Vec::new()
}

fn dedupe_contacts(contacts: Vec<AirportCommunication>) -> Vec<AirportCommunication> {
    let mut deduped = Vec::new();
    let mut seen = HashSet::new();

    for contact in contacts {
        let key = format!("{}:{:.3}", contact.service_type, contact.frequency_mhz);
        if seen.insert(key) {
            deduped.push(contact);
        }
    }

    deduped
}

fn join_runway_phrase(runways: &[String]) -> String {
    join_with_and(
        &runways
            .iter()
            .map(|runway| runway.to_string())
            .collect::<Vec<_>>(),
    )
}

fn join_with_and(items: &[String]) -> String {
    match items.len() {
        0 => String::new(),
        1 => items[0].clone(),
        2 => format!("{} and {}", items[0], items[1]),
        _ => {
            let mut prefix = items[..items.len() - 1].join(", ");
            prefix.push_str(", and ");
            prefix.push_str(&items[items.len() - 1]);
            prefix
        }
    }
}
