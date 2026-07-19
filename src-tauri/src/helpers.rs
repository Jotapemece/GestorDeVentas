use chrono::{Local, NaiveDate, Utc};
use crate::constants;

pub fn now_iso() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

pub fn fecha_hora_local() -> String {
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn siguiente_dia(fecha: &str) -> String {
    match NaiveDate::parse_from_str(fecha, "%Y-%m-%d") {
        Ok(d) => (d + chrono::Duration::days(1)).format("%Y-%m-%d").to_string(),
        Err(_) => constants::FECHA_MAXIMA.to_string(),
    }
}

pub fn validate_pago_movil_ref(referencia: Option<&str>) -> Result<(), String> {
    let r = referencia.unwrap_or("");
    if r.len() != constants::PAGO_MOVIL_REF_LEN {
        return Err("Pago móvil requiere los últimos 4 dígitos de referencia".to_string());
    }
    Ok(())
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

    #[test]
    fn test_fecha_hora_local_format() {
        let s = fecha_hora_local();
        assert_eq!(s.len(), 19);
        assert!(s.contains(' '));
    }

    #[test]
    fn test_siguiente_dia_normal() {
        assert_eq!(siguiente_dia("2026-07-19"), "2026-07-20");
    }

    #[test]
    fn test_siguiente_dia_fin_mes() {
        assert_eq!(siguiente_dia("2026-01-31"), "2026-02-01");
    }

    #[test]
    fn test_siguiente_dia_fin_anio() {
        assert_eq!(siguiente_dia("2026-12-31"), "2027-01-01");
    }

    #[test]
    fn test_siguiente_dia_invalido() {
        assert_eq!(siguiente_dia("invalido"), "9999-12-31");
    }

    #[test]
    fn test_validate_pago_movil_ref_ok() {
        assert!(validate_pago_movil_ref(Some("1234")).is_ok());
    }

    #[test]
    fn test_validate_pago_movil_ref_corta() {
        assert!(validate_pago_movil_ref(Some("12")).is_err());
    }

    #[test]
    fn test_validate_pago_movil_ref_none() {
        assert!(validate_pago_movil_ref(None).is_err());
    }
}
