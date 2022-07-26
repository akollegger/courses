import { UserCompletedCourse } from "../../../domain/events/UserCompletedCourse"
import { CourseWithProgress } from "../../../domain/model/course"
import { User } from "../../../domain/model/user"
import { appendParams, courseCypher } from "../../../domain/services/cypher"
import { emitter } from "../../../events"
import { write } from "../../../modules/neo4j"

export async function saveClassmarkerResult(sub: string, first: string, last: string, classmarkerId: number, certificateSerial: string, passed: boolean, percentage: number, timeFinished: number, viewResultsUrl: string): Promise<CourseWithProgress> {
    const res = await write(`
        MATCH (u:User {sub: $sub})-[:HAS_ENROLMENT]->(e)-[:FOR_COURSE]->(c {classmarkerId: $classmarkerId})
        WHERE e.createdAt >= datetime() - duration('PT2H')

        SET
            u.classmarkerFirstName = $first,
            u.classmarkerLastName = $last,
            e:FromCommunityGraph,
            e.updatedAt = datetime(),
            e.certificateNumber = $certificateSerial,
            e.percentage = toInteger($percentage),
            e.classmarkerResultsUrl = $viewResultsUrl,
            e.attempts = coalesce(e.attempts, 0) + 1,
            e.lastSeenAt = datetime()

        FOREACH (_ IN CASE WHEN $passed THEN [1] ELSE [] END |
            SET e:CompletedEnrolment,
                e.completedAt = datetime({epochSeconds: toInteger($timeFinished)})
        )

        FOREACH (_ IN CASE WHEN NOT $passed THEN [1] ELSE [] END |
            SET e:FailedEnrolment,
                e.failedAt = datetime({epochSeconds: toInteger($timeFinished)})
        )

        RETURN u,
            ${courseCypher('e', 'u')} AS course
    `, appendParams({
        sub,
        first,
        last,
        classmarkerId: classmarkerId.toString(),
        certificateSerial,
        passed,
        percentage,
        timeFinished,
        viewResultsUrl,
    }))

    const [record] = res.records

    const user: User = record.get('u')!
    const course: CourseWithProgress = record.get('course')

    if (passed) {
        emitter.emit(new UserCompletedCourse(user, course, undefined))
    }

    return course
}
