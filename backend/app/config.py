from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        extra="ignore",
    )

    firms_map_key: str = ""
    airnow_api_key: str = ""

    home_lat: float = 31.0381
    home_lon: float = -83.3690
    home_label: str = "Hahira, GA"

    bbox_west: float = -84.5
    bbox_south: float = 29.8
    bbox_east: float = -82.2
    bbox_north: float = 32.0

    alert_radius_urgent: float = 25
    alert_radius_email: float = 50
    alert_radius_dashboard: float = 75

    nws_zones: str = "GAZ155,GAZ153,GAZ154,GAZ156,GAZ157"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    twilio_to_numbers: str = ""

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_to: str = ""

    database_path: str = "./firewatcher.db"
    log_level: str = "INFO"

    @property
    def zone_list(self) -> list[str]:
        return [z.strip() for z in self.nws_zones.split(",") if z.strip()]

    @property
    def sms_recipients(self) -> list[str]:
        return [n.strip() for n in self.twilio_to_numbers.split(",") if n.strip()]

    @property
    def email_recipients(self) -> list[str]:
        return [e.strip() for e in self.smtp_to.split(",") if e.strip()]


settings = Settings()
