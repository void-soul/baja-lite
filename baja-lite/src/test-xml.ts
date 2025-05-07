import HTML from 'html-parse-stringify';
console.log((HTML.parse(`
    <sql id="reportField">
            a.left_e_foul leftEFoul,
            a.right_e_foul rightEFoul,
            a.left_em_foul leftEmFoul,
            a.right_em_foul rightEmFoul,
            a.left_s_foul leftSFoul,
            a.right_s_foul rightSFoul,
            a.left_sb_foul leftSbFoul,
            a.right_sb_foul rightSbFoul,
            a.left_p_foul leftPFoul,
            a.right_p_foul rightPFoul,
            a.left_attack_goal leftAttackGoal,
            a.right_attack_goal rightAttackGoal,
            a.left_point_goal leftPointGoal,
            a.right_point_goal rightPointGoal,
            a.left_over_time_goal leftOverTimeGoal,
            a.right_over_time_goal rightOverTimeGoal,
            a.left_normal_goal leftNormalGoal,
            a.right_normal_goal rightNormalGoal,
            a.left_own_goal leftOwnGoal,
            a.right_own_goal rightOwnGoal,
            a.left_time_out leftTimeOut,
            a.right_time_out rightTimeOut,
            a.left_coach_y_card leftCoachYCard,
            a.right_coach_y_card rightCoachYCard,
            a.left_player_r_card leftPlayerRCard,
            a.right_player_r_card rightPlayerRCard,
            a.left_jump_ball leftJumpBall,
            a.right_jump_ball rightJumpBall
    </sql>
    <select id="matchReport" resultType="org.jeecg.modules.event.entity.EventMatchReport">
        select
        b.event_name eventName,
        a.match_id matchId,
        a.event_times eventTimes,
        a.team_left_id teamLeftId,
        a.team_RIGHt_id teamRightId,
        a.team_left_name teamLeftName,
        a.team_right_name teamRightName,
        a.team_left_image teamLeftImage,
        a.team_right_image teamRightImage,
        <include refid="reportField" />
        <if test="matchInfo.reportType!=null and matchInfo.reportType!=''">
            from view_match_report a
        </if>
        <if test="matchInfo.reportType==null or matchInfo.reportType==''">
            from event_match_report a
        </if>
        left join event_main_info b on a.event_id = b.id
        <where>
            <if test="matchInfo.id!=null and matchInfo.id!=''">
                and a.match_id = #{matchInfo.id}
            </if>
            <if test="matchInfo.eventId!=null and matchInfo.eventId!=''">
                and a.event_id = #{matchInfo.eventId}
            </if>
            <if test="matchInfo.teamLeftId!=null and matchInfo.teamLeftId!=''">
                and (a.team_left_id = #{matchInfo.teamLeftId} OR a.team_right_id = #{matchInfo.teamLeftId})
            </if>
            <if test="dataIdList!=null">
                and a.event_id in
                <foreach collection="dataIdList" item="item" open="(" close=")" separator=",">
                    #{item}
                </foreach>
            </if>
        </where>
    </select>
>`)));