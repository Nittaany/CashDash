pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        AWS_CREDENTIALS_ID = 'aws-credentials' // The Jenkins ID we saved
        S3_BUCKET = 'aws-bucket-cashdash951'
        REGION = 'ap-south-1'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Nittaany/CashDash.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install --legacy-peer-deps'
            }
        }

        stage('Build') {
            steps {
                sh 'CI=false npm run build' // bypass ESLint in CI
            }
        }

        stage('Deploy to S3') {
            steps {
                withAWS(credentials: "${AWS_CREDENTIALS_ID}", region: "${REGION}") {
                    sh """
                        aws s3 sync build/ s3://${S3_BUCKET}/ \
                        --delete \
                        --acl public-read
                    """
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
        }
        success {
            echo 'Deployment succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
