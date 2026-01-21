# contextflow/services/utils.py

def format_duration(seconds: int) -> str:
    """
    Formata segundos (int/float) para 'HH:MM:SS' ou 'MM:SS'.
    Ex: 65 -> '00:01:05'
    """
    if not seconds:
        return "00:00:00"
    
    try:
        val = int(float(seconds))
        m, s = divmod(val, 60)
        h, m = divmod(m, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"
    except (ValueError, TypeError):
        return "00:00:00"
