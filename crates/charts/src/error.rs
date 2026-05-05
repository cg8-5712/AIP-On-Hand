use std::fmt;

#[derive(Debug)]
pub enum ChartError {
    InvalidInput(String),
    Unavailable(String),
    NotFound(String),
    Internal(String),
}

impl fmt::Display for ChartError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInput(message)
            | Self::Unavailable(message)
            | Self::NotFound(message)
            | Self::Internal(message) => formatter.write_str(message),
        }
    }
}

impl std::error::Error for ChartError {}
