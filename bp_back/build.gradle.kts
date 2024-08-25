plugins {
    kotlin("jvm") version "2.0.20"
    kotlin("plugin.serialization") version "2.0.20"
    id("io.ktor.plugin") version "2.3.12"
}

group = "com.bagplease"
version = "0.13.0"

application {
    mainClass.set("io.ktor.server.netty.EngineMain")

    val isDevelopment: Boolean = project.ext.has("development")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

kotlin {
    jvmToolchain(21)
}

repositories {
    mavenCentral()
}

dependencies {
    val kotlinVer = "2.0.20"
    val arrowVer = "1.2.4"

    val logbackVer = "1.5.7"
    val ktorVer = "2.3.12"
    val gqlServerVer = "7.1.4"
    val mongoVer = "5.1.0"

    val kotestVer = "5.9.1"

    implementation("io.arrow-kt:arrow-core:$arrowVer")
    implementation("io.arrow-kt:arrow-fx-coroutines:$arrowVer")

    implementation("io.ktor:ktor-server-core-jvm")
    implementation("io.ktor:ktor-server-auth")
    implementation("io.ktor:ktor-server-auth-jwt")
    implementation("io.ktor:ktor-server-cors-jvm")
    implementation("io.ktor:ktor-server-call-logging-jvm")
    implementation("io.ktor:ktor-server-content-negotiation")
    implementation("io.ktor:ktor-serialization-jackson")
    implementation("io.ktor:ktor-server-netty-jvm")
    implementation("io.ktor:ktor-server-websockets")
    implementation("io.ktor:ktor-server-config-yaml:$ktorVer")
    implementation("com.expediagroup:graphql-kotlin-ktor-server:$gqlServerVer")
    implementation("ch.qos.logback:logback-classic:$logbackVer")

    implementation("org.mongodb:mongodb-driver-kotlin-coroutine:$mongoVer")
    implementation("org.mongodb:bson-kotlinx:$mongoVer")

    testImplementation("io.ktor:ktor-server-tests-jvm")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:$kotlinVer")
    testImplementation("io.kotest:kotest-runner-junit5:$kotestVer")
    testImplementation("io.kotest:kotest-property:$kotestVer")
    testImplementation("io.kotest.extensions:kotest-assertions-ktor:2.0.0")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}


