pipeline {
    agent any

    environment {
        NODE_VERSION = "22"
        NPM_CI = "11.6.2"
        REACT_APP_CI = "false"      // ignore ESLint in CI
        S3_BUCKET = "aws-bucket-cashdash951"
        AWS_REGION = "ap-south-1"
    }

    stages {

        stage('Checkout') {
            steps {
                echo "Checking out Git repository..."
                git url: 'https://github.com/Nittaany/CashDash.git', branch: 'main'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo "Installing npm dependencies..."
                sh 'npm install --legacy-peer-deps'
            }
        }

        stage('Build React App') {
            steps {
                echo "Building React app (CI=false to bypass ESLint errors)..."
                sh 'CI=$REACT_APP_CI npm run build'
            }
        }

        stage('Deploy to S3') {
            steps {
                echo "Deploying build/ folder to AWS S3..."
                withCredentials([usernamePassword(
                    credentialsId: 'RA2211003011947',      
                    usernameVariable: 'AWS_ACCESS_KEY_ID',
                    passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                )]) {
                    docker.image('amazon/aws-cli').inside {
                        sh """
                        aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
                        aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
                        aws configure set default.region $AWS_REGION
                        aws s3 cp build/ s3://$S3_BUCKET/ --recursive
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline finished successfully!'
        }
        failure {
            echo '❌ Pipeline failed. Check console logs.'
        }
    }
}
