/*
 * #996 native WinPE rename reconciliation CORE — NO OPERATING-SYSTEM I/O.
 *
 * Pure C11 source for the future independently approved, signed native
 * Windows helper. This module NEVER moves a directory, opens a volume,
 * changes an ACL or confers C-grade execution authorization.
 *
 * After an interruption, gather source and destination file identities via
 * trusted handle-based native queries. Evaluate the saved expected identity
 * BEFORE attempting any further rename. An ambiguous result must STOP;
 * neither suffix retries nor copying, clobbering, or deleting are permitted.
 */
#include <stdbool.h>
#include <stdint.h>

typedef struct {
    bool exists;
    /* FILE_ID_INFO: 64-bit VolumeSerialNumber and 128-bit FileId. */
    uint64_t volume_serial;
    uint64_t file_id_low;
    uint64_t file_id_high;
} c996_file_identity;

typedef enum {
    C996_RENAME_PENDING = 1,  /* original source only; no rename proven */
    C996_RENAME_DONE = 2,     /* exact archived destination only */
    C996_RENAME_STOP_BOTH = 3,
    C996_RENAME_STOP_NEITHER = 4,
    C996_RENAME_STOP_IDENTITY = 5,
    C996_RENAME_STOP_BAD_EXPECTATION = 6
} c996_rename_resolution;

/* Not an execution permission: PENDING can be acted on only after independent
 * Owner approval, native no-replace semantics, and physical isolation proof. */
c996_rename_resolution c996_resolve_rename(
    c996_file_identity source,
    c996_file_identity archived,
    c996_file_identity expected)
{
    if (!expected.exists || (expected.file_id_low == UINT64_C(0) &&
                             expected.file_id_high == UINT64_C(0)))
        return C996_RENAME_STOP_BAD_EXPECTATION;
    if (source.exists && archived.exists)
        return C996_RENAME_STOP_BOTH;
    if (!source.exists && !archived.exists)
        return C996_RENAME_STOP_NEITHER;

    const c996_file_identity actual = source.exists ? source : archived;
    if (actual.volume_serial != expected.volume_serial ||
        actual.file_id_low != expected.file_id_low ||
        actual.file_id_high != expected.file_id_high)
        return C996_RENAME_STOP_IDENTITY;

    return source.exists ? C996_RENAME_PENDING : C996_RENAME_DONE;
}

/* The only permitted single-WinPE-boot sequence is old C, continuation C,
 * install lease LAST. Each step has its own immutable expected identity.
 * Returning READY_TO_* only identifies the next uncompleted namespace move;
 * it does not authorize executing that move or imply a live Owner approval. */
typedef enum {
    C996_THREE_STOP = 0,
    C996_THREE_READY_OLD_C = 1,
    C996_THREE_READY_CONTINUATION = 2,
    C996_THREE_READY_INSTALL = 3,
    C996_THREE_ALL_ARCHIVED = 4
} c996_three_resolution;

c996_three_resolution c996_resolve_three(
    const c996_file_identity source[3],
    const c996_file_identity archived[3],
    const c996_file_identity expected[3])
{
    if (source == 0 || archived == 0 || expected == 0)
        return C996_THREE_STOP;

    c996_rename_resolution state[3];
    for (unsigned int i = 0; i < 3; ++i) {
        state[i] = c996_resolve_rename(source[i], archived[i], expected[i]);
        if (state[i] != C996_RENAME_PENDING && state[i] != C996_RENAME_DONE)
            return C996_THREE_STOP;
    }

    /* A later move may never have completed before any earlier move. */
    if (state[1] == C996_RENAME_DONE && state[0] != C996_RENAME_DONE)
        return C996_THREE_STOP;
    if (state[2] == C996_RENAME_DONE && state[1] != C996_RENAME_DONE)
        return C996_THREE_STOP;

    if (state[0] == C996_RENAME_PENDING)
        return C996_THREE_READY_OLD_C;
    if (state[1] == C996_RENAME_PENDING)
        return C996_THREE_READY_CONTINUATION;
    if (state[2] == C996_RENAME_PENDING)
        return C996_THREE_READY_INSTALL;
    return C996_THREE_ALL_ARCHIVED;
}

#ifdef C996_RECONCILE_TEST_ONLY
#include <assert.h>

int main(void)
{
    const c996_file_identity expected = {true, UINT64_C(0x1000000087654321),
        UINT64_C(0x1234000000005678), UINT64_C(0xFEDCBA9876543210)};
    const c996_file_identity absent = {false, 0, 0, 0};
    const c996_file_identity other_id = {true, UINT64_C(0x1000000087654321),
        UINT64_C(0x1234000000005679), UINT64_C(0xFEDCBA9876543210)};
    const c996_file_identity other_high_id = {true, UINT64_C(0x1000000087654321),
        UINT64_C(0x1234000000005678), UINT64_C(0xFEDCBA9876543211)};
    const c996_file_identity other_volume = {true, UINT64_C(0x1000000087654320),
        UINT64_C(0x1234000000005678), UINT64_C(0xFEDCBA9876543210)};
    const c996_file_identity invalid = {true, UINT64_C(0x1000000087654321), 0, 0};
    const c996_file_identity missing_expectation = {false, 0, 0, 0};

    assert(c996_resolve_rename(expected, absent, expected) ==
           C996_RENAME_PENDING);
    assert(c996_resolve_rename(absent, expected, expected) ==
           C996_RENAME_DONE);
    assert(c996_resolve_rename(expected, expected, expected) ==
           C996_RENAME_STOP_BOTH);
    assert(c996_resolve_rename(expected, other_id, expected) ==
           C996_RENAME_STOP_BOTH);
    assert(c996_resolve_rename(absent, absent, expected) ==
           C996_RENAME_STOP_NEITHER);
    assert(c996_resolve_rename(other_id, absent, expected) ==
           C996_RENAME_STOP_IDENTITY);
    assert(c996_resolve_rename(absent, other_id, expected) ==
           C996_RENAME_STOP_IDENTITY);
    assert(c996_resolve_rename(other_high_id, absent, expected) ==
           C996_RENAME_STOP_IDENTITY);
    assert(c996_resolve_rename(absent, other_high_id, expected) ==
           C996_RENAME_STOP_IDENTITY);
    assert(c996_resolve_rename(other_volume, absent, expected) ==
           C996_RENAME_STOP_IDENTITY);
    assert(c996_resolve_rename(absent, other_volume, expected) ==
           C996_RENAME_STOP_IDENTITY);
    assert(c996_resolve_rename(expected, absent, invalid) ==
           C996_RENAME_STOP_BAD_EXPECTATION);
    assert(c996_resolve_rename(expected, absent, missing_expectation) ==
           C996_RENAME_STOP_BAD_EXPECTATION);

    const c996_file_identity pins[3] = {
        expected,
        {true, UINT64_C(0x1000000087654321), UINT64_C(0x1234000000005680),
            UINT64_C(0xFEDCBA9876543210)},
        {true, UINT64_C(0x1000000087654321), UINT64_C(0x1234000000005681),
            UINT64_C(0xFEDCBA9876543210)},
    };
    c996_file_identity sources[3] = {pins[0], pins[1], pins[2]};
    c996_file_identity archives[3] = {absent, absent, absent};
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_READY_OLD_C);
    sources[0] = absent; archives[0] = pins[0];
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_READY_CONTINUATION);
    sources[1] = absent; archives[1] = pins[1];
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_READY_INSTALL);
    sources[2] = absent; archives[2] = pins[2];
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_ALL_ARCHIVED);

    /* Install lease must never be archived while the new C claim is active. */
    sources[1] = pins[1]; archives[1] = absent;
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_STOP);
    sources[2] = pins[2]; archives[2] = absent;
    sources[0] = pins[0]; archives[0] = absent;
    sources[1] = absent; archives[1] = pins[1];
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_STOP);

    sources[1] = pins[1]; archives[1] = absent;
    sources[0] = other_id;
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_STOP);
    sources[0] = absent;
    assert(c996_resolve_three(sources, archives, pins) == C996_THREE_STOP);
    assert(c996_resolve_three(0, archives, pins) == C996_THREE_STOP);
    return 0;
}
#endif
