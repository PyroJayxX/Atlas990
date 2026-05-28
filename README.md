# Atlas990

A full-stack web application built with React and FastAPI that cleans raw public IRS Form 990 tax data into an optimized Parquet format. It uses an XGBoost model to calculate a 0–100 priority score for nonprofit leads and integrates Meta's FAISS library to instantly find matching lookalike organizations via vector similarity search.

## 🛠️ Stack

- **Frontend:** React (Vite, React Router)
- **Backend API:** FastAPI
- **Data & Modeling Engine:** XGBoost, FAISS, Pandas, NumPy, Parquet