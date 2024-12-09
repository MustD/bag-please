package com.bag_please

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform