#!/bin/sh

ls -la
echo 'Creating python virtual environment "backend/backend_env"'
python3 -m venv backend/backend_env

echo ""
echo "Restoring backend python packages"
echo ""

cd backend
./backend_env/bin/python -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Failed to restore backend python packages"
    exit $?
fi

echo ""
echo "Starting backend"
echo ""

cd ../backend

./backend_env/bin/python -m flask run --port=5000 --reload --debug --host=0.0.0.0
if [ $? -ne 0 ]; then
    echo "Failed to start backend"
    exit $?
fi
