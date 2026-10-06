import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runwaysInUse } from '../src/server/runways.ts';

// Snippets from real VATSIM ATIS broadcasts.
const atis = (callsign: string, text: string) => ({ callsign, text_atis: [text] });

test('simple "in use" phrasing', () => {
  assert.deepEqual(runwaysInUse([atis('ENBR_ATIS', 'ILS WHISKEY APPROACH .. RUNWAY IN USE 17 .. TRANSITION LEVEL 85')]), {
    arr: ['17'], dep: ['17'],
  });
  assert.deepEqual(runwaysInUse([atis('LFRS_ATIS', 'EXPECT ILS Z RWY 03. RWY 03 IN USE. TRANSITION LEVEL 60. TEMP 22')]), {
    arr: ['03'], dep: ['03'],
  });
});

test('separate landing and departing runways', () => {
  assert.deepEqual(
    runwaysInUse([atis('KSEA_ATIS', 'ILS RWYS 16R AND 16L, APCH IN USE. DEPTG RWY 16L. NOTAMS... TWY B CLSD')]),
    { arr: ['16R', '16L'], dep: ['16L'] },
  );
  assert.deepEqual(runwaysInUse([atis('KGNV_ATIS', 'VIS APPS TO RWYS 29 AND 25 IN USE. LDG AND DEPTG RWYS 29 AND 25.')]), {
    arr: ['29', '25'], dep: ['29', '25'],
  });
});

test('spelled-out runway numbers; closed runways in NOTAMs ignored', () => {
  assert.deepEqual(
    runwaysInUse([
      atis(
        'OJAI_ATIS',
        'EXPECTED APPROACH ILS RUNWAY TWO SIX LEFT. LANDING TWO SIX LEFT. DEPARTURE RUNWAY. TWO SIX LEFT. NOTAMS... RUNWAY TWO SIX RIGHT. AND ZERO EIGHT LEFT. CLOSED',
      ),
    ]),
    { arr: ['26L'], dep: ['26L'] },
  );
});

test('split arrival / departure ATIS', () => {
  assert.deepEqual(
    runwaysInUse([
      atis('LEPA_A_ATIS', 'INFORMATION D AT TIME 1530Z. RWY IN USE FOR ARRIVALS 24 LEFT. EXPECT ILS Z APPROACH RWY 24 LEFT.'),
      atis('LEPA_D_ATIS', 'INFORMATION D AT TIME 1530Z. RWY IN USE FOR DEPARTURES 24 RIGHT.'),
    ]),
    { arr: ['24L'], dep: ['24R'] },
  );
  assert.deepEqual(
    runwaysInUse([
      atis('EDDF_A_ATIS', 'INDEPENDENT PARALLEL ILS Y APCH RWY 25R OR ILS APCH RWY 25L RWY 25R 25L DO NOT MISTAKE TWY M FOR RWY 25C WHEN PERFORMING VISUAL APPROACH'),
      atis('EDDF_D_ATIS', 'ATIS EDDF D METAR 051520 RWY 25C 18 ACDM IN PROGRESS.'),
    ]),
    { arr: ['25R', '25L'], dep: ['25C', '18'] },
  );
});

test('out-of-service, condition reports and vacating instructions are not runways in use', () => {
  assert.deepEqual(
    runwaysInUse([atis('KJAX_ATIS', 'VIS APCH TO RWYS 8 AND 14 IN USE. DEPTG RWYS 8 AND 14. NOTAMS... RWY 8 OM OTS.')]),
    { arr: ['8', '14'], dep: ['8', '14'] },
  );
  assert.deepEqual(
    runwaysInUse([atis('EKBI_A_ATIS', 'VECTORS FOR ILS-Z APP RWY IN USE 27 RUNWAY 27 CONDITION REPORT AT 1520Z')]),
    { arr: ['27'], dep: [] },
  );
  assert.deepEqual(
    runwaysInUse([atis('EDDB_ATIS', 'ILS Z APPROACH RUNWAYS IN USE 24R AND 24L. AFTER VACATING RUNWAY 24L OR 24R REMAIN ON FREQUENCY')]),
    { arr: ['24R', '24L'], dep: ['24R', '24L'] },
  );
});

test('no runway information', () => {
  assert.equal(runwaysInUse([atis('OKKK_ATIS', 'KUWAIT INFORMATION A. WIND 310 DEGREES 10 KNOTS.')]), undefined);
  assert.equal(runwaysInUse([]), undefined);
});

test('arrival and departure named in one phrase', () => {
  assert.deepEqual(
    runwaysInUse([atis('LEBL_D_ATIS', 'LEBL ATIS ARR F 1530Z  RWY IN USE FOR ARR 06L AND FOR DEP 06R. DATALINK DEP CLR AVBL')]),
    { arr: ['06L'], dep: ['06R'] },
  );
});

test('runways offered on request or used for wind reports are not in use', () => {
  assert.deepEqual(
    runwaysInUse([atis('EDDS_ATIS', 'EXPECT VECTORING FOR ILS APCH RWY 25 WHEN AIRBORNE CONTACT LANGEN RADAR. OPPOSITE DEPARTURE RWY 07 ON REQUEST AVAILABLE TRL 60')]),
    { arr: ['25'], dep: ['25'] },
  );
  assert.deepEqual(
    runwaysInUse([
      atis('LZIB_A_ATIS', 'ILS Z APPR, RWY IN USE 31, EXPECT 2M ARRIVALS. WIND 28005KT'),
      atis('LZIB_D_ATIS', 'ATIS REPORT AT 1530Z. . WIND DEPARTURE RWY 04 TOUCHDOWN ZONE 28005KT CAVOK'),
    ]),
    { arr: ['31'], dep: [] },
  );
});
