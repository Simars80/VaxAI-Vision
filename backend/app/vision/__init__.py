from app.vision.inference import VVMClassifier, get_classifier

__all__ = ["VVMClassifier", "get_classifier"]


def get_stock_detector(*args, **kwargs):
    from app.vision.stock_detector import get_stock_detector as _get
    return _get(*args, **kwargs)
