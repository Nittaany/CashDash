pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        AWS_CREDENTIALS_ID = 'RA2211003011947' // Your Jenkins AWS credentials
        S3_BUCKET = 'aws-bucket-cashdash951'
        REGION = 'ap-south-1'
        CLOUDFRONT_DIST_ID = 'EQZNQAZW1UMNH' // Your CloudFront distribution
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
                sh 'CI=false npm run build' // bypass ESLint warnings in CI
            }
        }

        stage('Deploy to S3') {
            steps {
                withAWS(credentials: "${AWS_CREDENTIALS_ID}", region: "${REGION}") {
                    sh """
                        # Sync build folder to S3 bucket (no ACL, bucket ownership enforced)
                        aws s3 sync build/ s3://${S3_BUCKET}/ --delete
                        
                        # Optional: Invalidate CloudFront cache
                        aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DIST_ID} --paths "/*"
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
