package com.bagplease.mongo.model

import org.bson.codecs.pojo.annotations.BsonId
import java.util.*

data class MongoItem(
    @BsonId
    val id: UUID,
    val name: String,
    val checked: Boolean,
)
