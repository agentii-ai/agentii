# agentii-models

Shared Pydantic v2 data models for the [Agentii financial IDE](https://github.com/agentii-ai/agentii) — US stocks, options, biotech catalysts, portfolio positions, order execution, and provider abstraction.

## Installation

```bash
pip install agentii-models

# With orjson for fast JSON serialization
pip install "agentii-models[json]"

# With pyarrow for Parquet support
pip install "agentii-models[parquet]"

# Development
pip install -e ".[dev]"
```

## Usage

```python
from agentii_models import StockBar, OptionQuote, Greeks, OptionsChain
from agentii_models.enums import AssetClass, BarTimeframe, OptionType
```

## Requirements

- Python 3.12+
- Pydantic v2.6+
