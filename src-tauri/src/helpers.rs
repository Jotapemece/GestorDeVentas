use chrono::Utc;

pub fn now_iso() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_now_iso_format() {
        let s = now_iso();
        assert!(s.len() >= 20);
        assert!(s.ends_with('Z'));
        assert!(s.contains('T'));
    }
}
