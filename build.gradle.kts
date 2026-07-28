import com.github.benmanes.gradle.versions.updates.DependencyUpdatesTask

group = "com.bagplease"

tasks.register("syncFrontendVersion") {
    description = "Sync package.json version from gradle.properties"
    doLast {
        val pkgFile = file("bp_front/package.json")
        pkgFile.writeText(
            pkgFile.readText().replace(
                Regex(""""version":\s*"[^"]+""""),
                """"version": "$version""""
            )
        )
        println("bp_front/package.json version set to $version")
    }
}


tasks.named<DependencyUpdatesTask>("dependencyUpdates") {
    revision = "release"
    outputFormatter = "plain,json"
}
